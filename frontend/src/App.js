import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import { Trash2, Mic, Share2, User } from "lucide-react";

const userId = "123"; // Simulated User ID (Replace with dynamic user auth later)

const ChatApp = () => {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState(navigator.language.split("-")[0] || "en");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const chatEndRef = useRef(null);
  const recognition = useRef(null);
  const speechSynthesisRef = useRef(window.speechSynthesis);
  const currentUtteranceRef = useRef(null);

  const newChat = async () => {
    try {
      console.log("Starting a new chat...");
      const response = await fetch("http://localhost:8000/chat/new", { 
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
  
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  
      const data = await response.json();
      console.log("New session created:", data.session_id); // ✅ Debugging log
  
      if (data.session_id) {
        setActiveSession(data.session_id); // ✅ Set new session ID
        setChat([{ 
          message: "Hello there! 👋 Welcome to our nutrition-focused chatbot! I'm here to help you navigate the world of children's nutrition and provide personalized advice for your little one. Let's get started!",
          sender: "bot",
          timestamp: new Date()
        }]);
        
        setTimeout(() => fetchChatHistory(), 500); // ✅ Ensure it updates properly
      } else {
        console.error("Error: No session ID received from backend.");
      }
    } catch (error) {
      console.error("Error creating new chat:", error);
    }
  };
  

  // ✅ Initialize Speech Recognition
  useEffect(() => {
    if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
      recognition.current = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      recognition.current.continuous = false;
      recognition.current.lang = detectedLanguage;
      recognition.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setMessage(transcript);
      };
      recognition.current.onend = () => setIsListening(false);
    } else {
      console.warn("Speech Recognition not supported in this browser.");
    }
  }, [detectedLanguage]);

  // ✅ Fetch Chat History
  const fetchChatHistory = async () => {
    try {
      const response = await fetch(`http://localhost:8000/chat/history/${userId}`);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const data = await response.json();
      if (data.chat_sessions) setSessions(data.chat_sessions);
    } catch (error) {
      console.error("Error fetching chat history:", error);
    }
  };

  useEffect(() => {
    fetchChatHistory();
  }, []);

  useEffect(() => {
    localStorage.setItem("chatHistory", JSON.stringify(chat));
  }, [chat]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);
  useEffect(() => {
    setChat([{
      message: "Hello there! 👋 Welcome to our nutrition-focused chatbot! I'm here to help you navigate the world of children's nutrition and provide personalized advice for your little one. Let's get started!",
      sender: "bot",
      timestamp: new Date()
    }]);
    setTimeout(() => fetchChatHistory(), 500);  // ✅ Adds delay before fetching history
  }, []);
  // ✅ Send Message
  const sendMessage = async () => {
    if (!message.trim()) return;
    const newChat = [...chat, { message, sender: "user", timestamp: new Date() }];
    setChat(newChat);
    setMessage("");

    try {
      const response = await fetch("http://localhost:8000/chat/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          user_id: userId,
          session_id: activeSession,
          lang: detectedLanguage,
        }),
      });

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const data = await response.json();
      setActiveSession(data.session_id);
      setChat([...newChat, { message: data.response, sender: "bot", timestamp: new Date() }]);
      fetchChatHistory();
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };
// ✅ Fix `loadSession` function
const loadSession = (sessionId) => {
  console.log("Loading session:", sessionId);
  const selectedSession = sessions.find((s) => s.session_id === sessionId);

  if (selectedSession) {
    console.log("Selected session messages:", selectedSession.messages);
    setChat(selectedSession.messages || []); // ✅ Load messages into chat
    setActiveSession(sessionId); // ✅ Set active session
  } else {
    console.warn("Session not found:", sessionId);
  }
};


  // ✅ Share Chat
  const shareChat = () => {
    const chatText = chat.map(msg => `${msg.sender === "bot" ? "Bot" : "You"}: ${msg.message}`).join("\n");
    if (navigator.share) {
      navigator.share({
        title: "Chat Conversation",
        text: chatText,
      }).catch((err) => console.error("Error sharing chat:", err));
    } else {
      navigator.clipboard.writeText(chatText);
      alert("Chat copied to clipboard! 📋");
    }
  };

  // ✅ Close Profile Menu When Clicking Outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".profile-menu")) setShowProfileMenu(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <div className="w-64 bg-gray-50 border-r border-gray-200 p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-red-500 rounded-full"></div>
          <h1 className="text-xl font-semibold">POSHANA GPT</h1>
        </div>

        <button 
  onClick={newChat} 
  className="w-full mb-4 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
>
  ➕ New Chat
</button>


        {/* Chat History */}
        {/* ✅ Fix Chat History Display & Click */}
<div className="overflow-y-auto flex-grow mt-2" style={{ maxHeight: "calc(100vh - 200px)" }}>
  {sessions.length > 0 ? (
    sessions.map((session) => (
      <button
        key={session.session_id}
        className="w-full text-left p-2 hover:bg-gray-100 rounded"
        onClick={() => loadSession(session.session_id)} // ✅ Ensure this function is triggered
      >
        {session.messages.length > 0 ? session.messages[0].message.slice(0, 20) + "..." : "New Chat"}
      </button>
    ))
  ) : (
    <p className="text-gray-500 mt-2">No chat history found.</p>
  )}
</div>
      
      
      </div>
      
      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        <header className="p-4 border-b border-gray-200 flex justify-between">
          <h1 className="text-xl font-semibold">📌 POSHANA GPT</h1>

          <div className="flex gap-4">
            {/* Share Button */}
            <button onClick={shareChat} className="flex items-center gap-1 text-gray-600 hover:text-gray-800">
              <Share2 size={16} /> Share
            </button>

            {/* Profile Button */}
            <button className="profile-menu" onClick={() => setShowProfileMenu(!showProfileMenu)}>
              <User size={20} className="text-gray-600 hover:text-gray-800" />
            </button>
          </div>
        </header>

        {/* Profile Dropdown */}
        {showProfileMenu && (
          <div className="absolute right-4 top-12 bg-white shadow-lg rounded-lg w-40">
            <button className="block w-full p-2 hover:bg-gray-100" onClick={() => setShowSettings(true)}>⚙️ Settings</button>
            <button className="block w-full p-2 text-red-500 hover:bg-gray-100" onClick={() => console.log("Logout")}>🚪 Logout</button>
          </div>
        )}

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {chat.map((msg, index) => (
            <div key={index} className={`flex ${msg.sender === "bot" ? "justify-start" : "justify-end"} items-center mb-4`}>
              <div className={`max-w-[80%] p-3 rounded-lg ${msg.sender === "bot" ? "bg-gray-100 text-gray-800" : "bg-blue-600 text-white"}`}>
                {msg.message}
              </div>
              {msg.sender === "user" && <Trash2 size={16} onClick={() => console.log("Delete Message")} className="ml-2 text-red-500 hover:text-red-700 cursor-pointer" />}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input Box */}
        <div className="p-4 border-t border-gray-200 flex gap-2">
          <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} onKeyPress={(e) => e.key === "Enter" && sendMessage()} placeholder="Type your prompt..." className="flex-1 p-3 border rounded-lg" />
          <Mic size={24} onClick={() => console.log("Start Listening")} className="cursor-pointer text-gray-600 hover:text-black" />
          <button onClick={sendMessage} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Send</button>
        </div>
      </div>
    </div>
  );
};

export default ChatApp;
