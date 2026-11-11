'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import ChartRenderer from './ChartRenderer';
import styles from './Chatbot.module.css';
import { validateMessages } from '../lib/chat-limits.mjs';

export default function Chatbot() {
  // Extrai blocos ```chart ... ``` da resposta do Gemini
  // Retorna { text: string, chart: object|null }
  const parseMessage = (content) => {
    const chartRegex = /```chart\s*([\s\S]*?)```/;
    const match = content.match(chartRegex);
    if (match) {
      try {
        const chartConfig = JSON.parse(match[1].trim());
        const text = content.replace(chartRegex, '').trim();
        return { text, chart: chartConfig };
      } catch {
        // JSON inválido — exibe como texto normal
        return { text: content, chart: null };
      }
    }
    return { text: content, chart: null };
  };

  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: 'Olá. Sou o Assistente de Inteligência Artificial Delta. Como posso ajudar nas análises executivas hoje?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { id: Date.now(), role: 'user', content: input };
    const updatedMessages = [...messages, userMessage];
    try { validateMessages(updatedMessages); }
    catch (error) { setError(error.message); return; }
    setError('');
    
    setMessages(updatedMessages);
    setInput('');
    setIsTyping(true);

    try {
      // Integration with the backend Next.js API route
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: updatedMessages,
        }),
      });

      if (!response.ok) {
        if ([400, 413].includes(response.status)) {
          const failure = await response.json();
          setError(failure.error || 'Reduza o texto ou inicie uma nova conversa.');
          setMessages(messages);
          setInput(userMessage.content);
          return;
        }
        throw new Error('Erro na comunicação com o backend');
      }

      const data = await response.json();
      
      const botMessage = {
        id: Date.now() + 1,
        role: data.role,
        content: data.content
      };
      
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error(error);
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Desculpe, houve uma falha de conexão com os servidores. Tente novamente mais tarde.'
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className={styles.chatbotContainer}>
      <div className={styles.messagesArea}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.messageWrapper} ${msg.role === 'user' ? styles.userWrapper : styles.botWrapper}`}
          >
            {msg.role === 'assistant' && (
              <div className={styles.botAvatar}>
                <div className={styles.botAvatarImage} />
              </div>
            )}
            <div className={`${styles.messageBubble} ${msg.role === 'user' ? styles.userBubble : styles.botBubble}`}>
              {msg.role === 'assistant' ? (() => {
                const { text, chart } = parseMessage(msg.content);
                return (
                  <>
                    {text && <ReactMarkdown>{text}</ReactMarkdown>}
                    {chart && <ChartRenderer config={chart} />}
                  </>
                );
              })() : (
                msg.content
              )}
            </div>
            {msg.role === 'user' && (
              <div className={styles.userAvatar}>KC</div>
            )}
          </div>
        ))}
        {isTyping && (
          <div className={`${styles.messageWrapper} ${styles.botWrapper}`}>
            <div className={styles.botAvatar}>
              <div className={styles.botAvatarImage} />
            </div>
            <div className={`${styles.messageBubble} ${styles.botBubble} ${styles.typingIndicator}`}>
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputArea}>
        {error && <p role="alert">{error}</p>}
        <button type="button" disabled={isTyping} onClick={() => {
          setMessages([]); setError('');
        }}>Nova conversa</button>
        <form onSubmit={handleSubmit} className={styles.inputForm}>
          <input
            type="text"
            className={styles.inputField}
            placeholder="Digite sua dúvida para começar..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            className={styles.sendBtn}
            disabled={!input.trim() || isTyping}
            aria-label="Enviar mensagem"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
