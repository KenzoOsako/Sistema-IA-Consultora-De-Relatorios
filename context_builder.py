"""
context_builder.py
==================
Transforma SheetResults em texto estruturado e otimizado para injeção no LLM.

Estratégia adaptativa por tamanho de tabela:
  ┌──────────────────┬──────────────────────────────────────────────────────┐
  │ Linhas           │ Estratégia                                           │
  ├──────────────────┼──────────────────────────────────────────────────────┤
  │ ≤ FULL_THRESHOLD │ FULL   → Tabela Markdown completa                    │
  │ ≤ SAMPLE_THRESH  │ SAMPLE → Amostra + estatísticas descritivas completas│
  │ > SAMPLE_THRESH  │ STATS  → Apenas estatísticas (sem linhas brutas)     │
  └──────────────────┴──────────────────────────────────────────────────────┘

Objetivo: maximizar informação útil ao Gemini minimizando tokens consumidos.
A abordagem garante que o modelo NUNCA receba uma tabela truncada no meio,
o que causaria confusão e potencial alucinação.
"""

from __future__ import annotations

import pandas as pd
from loguru import logger
from sheets_connector import SheetResult, SheetStatus


# ─── Thresholds Adaptativos ────────────────────────────────────────────────
FULL_THRESHOLD    = 200     # Até 200 linhas → tabela completa
SAMPLE_THRESHOLD  = 2_000   # Até 2.000 linhas → amostra + estatísticas
SAMPLE_SIZE       = 50      # Linhas na amostra quando aplicável
MAX_CONTEXT_CHARS = 80_000  # Limite de segurança total do contexto


# ─── Formatação de Valores ─────────────────────────────────────────────────

def _format_value(val) -> str:
    """Formata um valor Python para exibição legível na tabela de contexto."""
    if pd.isna(val):
        return "N/A"
    if isinstance(val, float):
        if val == int(val) and abs(val) < 1e12:
            return f"{int(val):,}".replace(",", ".")
        return f"{val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    if isinstance(val, pd.Timestamp):
        return val.strftime("%d/%m/%Y")
    return str(val).strip() or "N/A"


def _df_to_markdown(df: pd.DataFrame) -> str:
    """Converte um DataFrame para tabela Markdown com valores formatados."""
    formatted = df.copy()
    for col in formatted.columns:
        formatted[col] = formatted[col].apply(_format_value)

    try:
        return formatted.to_markdown(index=False, tablefmt="pipe")
    except Exception:
        return formatted.to_csv(index=False, sep="|")


# ─── Estatísticas Descritivas ──────────────────────────────────────────────

def _build_stats_block(df: pd.DataFrame) -> str:
    """
    Gera um bloco de estatísticas descritivas para colunas numéricas e categóricas.

    Para colunas numéricas: total, média, mediana, min, max, desvio padrão.
    Para colunas de data: período (data mínima → data máxima).
    Para colunas de texto: top 5 valores mais frequentes e seus percentuais.
    """
    lines: list[str] = []
    total_rows = len(df)

    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    date_cols    = df.select_dtypes(include="datetime").columns.tolist()
    text_cols    = [
        c for c in df.select_dtypes(include="object").columns
        if c not in numeric_cols + date_cols
    ]

    # ── Numéricas ──────────────────────────────────────────────────────────
    if numeric_cols:
        lines.append("#### 📊 Estatísticas — Colunas Numéricas\n")
        lines.append(
            "| Coluna | Soma | Média | Mediana | Mín | Máx | Desvio Padrão |"
        )
        lines.append("|--------|------|-------|---------|-----|-----|----------------|")
        for col in numeric_cols:
            series = df[col].dropna()
            if series.empty:
                continue
            lines.append(
                f"| {col} "
                f"| {_format_value(series.sum())} "
                f"| {_format_value(series.mean())} "
                f"| {_format_value(series.median())} "
                f"| {_format_value(series.min())} "
                f"| {_format_value(series.max())} "
                f"| {_format_value(series.std())} |"
            )
        lines.append("")

    # ── Datas ──────────────────────────────────────────────────────────────
    if date_cols:
        lines.append("#### 📅 Estatísticas — Colunas de Data\n")
        for col in date_cols:
            series = df[col].dropna()
            if series.empty:
                continue
            lines.append(
                f"- **{col}:** de `{series.min().strftime('%d/%m/%Y')}` "
                f"até `{series.max().strftime('%d/%m/%Y')}` "
                f"({series.nunique()} datas distintas)"
            )
        lines.append("")

    # ── Categóricas ────────────────────────────────────────────────────────
    if text_cols:
        lines.append("#### 🏷️ Distribuição — Colunas Categóricas\n")
        for col in text_cols:
            series = df[col].dropna().astype(str)
            if series.empty:
                continue
            unique_count = series.nunique()
            top = series.value_counts().head(5)

            lines.append(f"**{col}** ({unique_count} valores únicos):")
            for val, count in top.items():
                pct = (count / total_rows) * 100
                lines.append(f"  - `{val}`: {count} registros ({pct:.1f}%)")
            if unique_count > 5:
                lines.append(f"  - *... e mais {unique_count - 5} valores únicos.*")
            lines.append("")

    return "\n".join(lines)


# ─── Estratégias de Renderização ──────────────────────────────────────────

def _render_full(df: pd.DataFrame, label: str) -> str:
    """
    ESTRATÉGIA FULL: Tabela Markdown completa.
    Usada para planilhas pequenas (≤ FULL_THRESHOLD linhas).
    O Gemini recebe todos os dados brutos para análise irrestrita.
    """
    rows, cols = len(df), len(df.columns)
    header = (
        f"> **Modo:** Dados Completos | "
        f"**Registros:** {rows} | "
        f"**Colunas:** {cols}\n\n"
    )
    return header + _df_to_markdown(df)


def _render_sample_plus_stats(df: pd.DataFrame, label: str) -> str:
    """
    ESTRATÉGIA SAMPLE + STATS: Amostra estratificada + estatísticas completas.
    Usada para planilhas médias (FULL_THRESHOLD < linhas ≤ SAMPLE_THRESHOLD).

    A amostra é composta por: 25% primeiros + 25% últimos + 50% aleatório do meio.
    Isso garante representatividade sem viés de posição.
    """
    rows = len(df)
    n_head = max(1, SAMPLE_SIZE // 4)
    n_tail = max(1, SAMPLE_SIZE // 4)
    n_mid  = SAMPLE_SIZE - n_head - n_tail

    head_df = df.head(n_head)
    tail_df = df.tail(n_tail)
    mid_pool = df.iloc[n_head: max(n_head + 1, rows - n_tail)]
    mid_df   = mid_pool.sample(min(n_mid, len(mid_pool)), random_state=42)

    sample = (
        pd.concat([head_df, mid_df, tail_df])
        .drop_duplicates()
        .reset_index(drop=True)
    )

    header = (
        f"> **Modo:** Amostra + Estatísticas | "
        f"**Total de Registros:** {rows:,} | "
        f"**Colunas:** {len(df.columns)} | "
        f"**Amostra exibida:** {len(sample)} registros\n\n"
    )

    stats          = _build_stats_block(df)
    sample_section = (
        f"#### 🔍 Amostra Representativa ({len(sample)} de {rows:,} registros)\n\n"
        + _df_to_markdown(sample)
    )

    return header + stats + "\n---\n\n" + sample_section


def _render_stats_only(df: pd.DataFrame, label: str) -> str:
    """
    ESTRATÉGIA STATS ONLY: Apenas estatísticas agregadas, sem linhas brutas.
    Usada para planilhas grandes (> SAMPLE_THRESHOLD linhas).

    Para bases muito grandes, enviar linhas brutas consumiria todo o context
    window sem benefício real. Estatísticas agregadas são mais úteis ao LLM.
    """
    rows = len(df)
    header = (
        f"> **Modo:** Estatísticas Agregadas | "
        f"**Total de Registros:** {rows:,} | "
        f"**Colunas:** {len(df.columns)}\n"
        f"> ⚠️ Volume alto de dados: apenas estatísticas são exibidas. "
        f"Para consultar registros individuais, solicite filtragem específica.\n\n"
    )
    return header + _build_stats_block(df)


# ─── Renderizador de Resultado ─────────────────────────────────────────────

def _render_result(result: SheetResult) -> str:
    """
    Seleciona a estratégia de renderização baseada no SheetResult recebido.
    Trata todos os casos de erro com mensagens claras e prescritivas.
    """
    label = result.base.upper()

    # ── Casos de Erro ──────────────────────────────────────────────────────
    if result.status == SheetStatus.CONFIG:
        return (
            f"> ❌ **CONFIGURAÇÃO AUSENTE** | Base: {label}\n"
            f"> {result.error_message}\n"
            f"> **Ação necessária:** Verifique o arquivo `.env`.\n"
        )

    if result.status == SheetStatus.NOT_FOUND:
        return (
            f"> ❌ **PLANILHA NÃO ENCONTRADA** | Base: {label}\n"
            f"> {result.error_message}\n"
            f"> **Ação necessária:** Verifique o SPREADSHEET_ID e o nome da aba no `.env`.\n"
        )

    if result.status == SheetStatus.EMPTY:
        return (
            f"> ⚠️ **BASE DE DADOS VAZIA** | Base: {label}\n"
            f"> {result.error_message}\n"
            f"> Esta base não possui dados disponíveis no momento.\n"
        )

    if result.status == SheetStatus.OFFLINE:
        return (
            f"> 🔴 **SERVIÇO INDISPONÍVEL** | Base: {label}\n"
            f"> {result.error_message}\n"
            f"> **Ação necessária:** Verifique a conexão e as credenciais.\n"
        )

    # ── Sucesso: seleciona estratégia ──────────────────────────────────────
    df   = result.df
    rows = result.rows

    if rows <= FULL_THRESHOLD:
        strategy = "FULL"
        content  = _render_full(df, label)
    elif rows <= SAMPLE_THRESHOLD:
        strategy = "SAMPLE+STATS"
        content  = _render_sample_plus_stats(df, label)
    else:
        strategy = "STATS_ONLY"
        content  = _render_stats_only(df, label)

    logger.info(
        f"📐 Estratégia '{strategy}' aplicada para '{label}' "
        f"({rows:,} linhas → {len(content):,} chars)."
    )
    return content


# ─── Função Principal (Interface Pública) ─────────────────────────────────

def build_context(
    result_financeiro: SheetResult,
    result_rh: SheetResult,
) -> str:
    """
    Constrói o bloco de contexto completo para injeção no prompt do Gemini.

    Processa os dois SheetResults, aplica a estratégia de renderização
    adequada para cada um e monta o contexto final com separadores claros.

    Args:
        result_financeiro: SheetResult da base financeira.
        result_rh: SheetResult da base de RH.

    Returns:
        String Markdown otimizada para consumo pelo Gemini.
    """
    sections: list[str] = []

    sections.append("## 💰 BASE DE DADOS FINANCEIRA")
    sections.append(_render_result(result_financeiro))

    sections.append("---")

    sections.append("## 👥 BASE DE DADOS DE RECURSOS HUMANOS (RH)")
    sections.append(_render_result(result_rh))

    # ── Rodapé de disponibilidade (informa o LLM sobre o estado das bases) ─
    ok_bases = [
        r.base.upper()
        for r in [result_financeiro, result_rh]
        if r.is_ok
    ]
    unavailable_bases = [
        r.base.upper()
        for r in [result_financeiro, result_rh]
        if not r.is_ok
    ]

    footer_parts: list[str] = []
    if ok_bases:
        footer_parts.append(f"✅ Bases disponíveis: {', '.join(ok_bases)}")
    if unavailable_bases:
        footer_parts.append(
            f"❌ Bases indisponíveis: {', '.join(unavailable_bases)} "
            f"— Informe ao usuário caso ele pergunte sobre elas."
        )

    sections.append("---")
    sections.append("### Disponibilidade das Bases\n" + " | ".join(footer_parts))

    context = "\n\n".join(sections)

    if len(context) > MAX_CONTEXT_CHARS:
        logger.warning(
            f"⚠️  Contexto total ({len(context):,} chars) excede o limite "
            f"de segurança ({MAX_CONTEXT_CHARS:,} chars). "
            "Considere reduzir FULL_THRESHOLD ou SAMPLE_SIZE."
        )

    logger.debug(
        f"📝 Contexto final: {len(context):,} chars | "
        f"Financeiro: {result_financeiro.status.name} | "
        f"RH: {result_rh.status.name}"
    )
    return context
