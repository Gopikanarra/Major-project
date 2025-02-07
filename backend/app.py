import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import datetime, timezone  # ✅ Properly imported timezone
import uuid

load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure Gemini API
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Connect to MongoDB
mongo_client = MongoClient(os.getenv("MONGO_URI"))
db = mongo_client["chatbot_app"]
chats_collection = db["chats"]

NUTRITION_PROMPT = """
You are a pediatric nutritionist chatbot. Your task is to gather information through a step-by-step conversation.

IMPORTANT RULES:
1. You must ONLY ask ONE question at a time
2. DO NOT provide any nutrition advice or plans until you have gathered ALL required information
3. DO NOT skip ahead or make assumptions
4. If this is a new conversation, ALWAYS start with Question 1
5. Track which question number you're on and only proceed when you get an answer

FIRST MESSAGE:
If this is the start of the conversation, introduce yourself briefly and ask Question 1:
"Hello! I'm your pediatric nutrition assistant. To create a personalized nutrition plan, I need to ask you a few questions. First, what is your child's age?"

QUESTION SEQUENCE:
Q1: What is your child's age?
Q2: What is your child's current weight in kg?
Q3: What is your child's height in cm?
Q4: How would you describe your child's activity level (low/moderate/high)?
Q5: Does your child have any food allergies or restrictions?
Q6: What are your child's favorite foods?
Q7: What foods does your child dislike?
Q8: How many meals does your child typically eat per day?

After ALL questions are answered, THEN AND ONLY THEN provide the nutrition plan in this format:

SUMMARY:
[Provide brief summary of gathered information]

DAILY NUTRITION PLAN:
| Meal | Time | Food Items | Portion Size | Calories |
|------|------|------------|--------------|-----------|
| Breakfast | 8:00 AM | [Foods] | [Portions] | [Cal] |
[Continue table for all meals]

IMPLEMENTATION TIPS:
1. [Tip 1]
2. [Tip 2]
3. [Tip 3]

For each user message:
- If it's a new conversation: Ask Question 1
- If you already asked a question: Acknowledge their answer and ask the next question
- If the answer is unclear: Ask for clarification of the current question
- Only provide the final plan after Question 8 is answered
"""
# ✅ Store chat messages under a session ID
@app.route("/chat/", methods=["POST"])
def chat():
    data = request.json
    if not data:
        return jsonify({"error": "Invalid request format"}), 400  # Handle missing JSON
    
    user_message = data.get("message", "").strip()
    user_id = data.get("user_id", "guest")  # Default to 'guest' if no user_id
    session_id = data.get("session_id")  # Get existing session ID or None

    if not user_message:
        return jsonify({"response": "❌ Please enter a message."}), 400

    # Create new session if not provided
    if not session_id:
        session_id = str(uuid.uuid4())  # Generate a unique session ID

    conversation_history = ""
    chat_history = chats_collection.find_one({"session_id": session_id})
    
    if chat_history:
        for msg in chat_history.get("messages", []):
            conversation_history += f"{msg['sender']}: {msg['message']}\n"

    # Complete prompt with context
    if "nutrition" in user_message.lower():
        full_prompt = f"""{NUTRITION_PROMPT}--- Conversation History ---{conversation_history}--- New User Input ---User: {user_message}Assistant:"""
    else:
        full_prompt = f"User: {user_message}\nAssistant:"

    # Generate AI response
    model = genai.GenerativeModel("gemini-pro")
    response = model.generate_content(full_prompt)
    
    bot_reply = response.text.strip() if response and response.text else "⚠️ No response from AI."

    # Store conversation in MongoDB under the session
    chat_data = {
        "session_id": session_id,
        "user_id": user_id,
        "messages": [
            {"message": user_message, "sender": "user", "timestamp": datetime.now(timezone.utc)},
            {"message": bot_reply, "sender": "bot", "timestamp": datetime.now(timezone.utc)}
        ],
    }

    # ✅ Ensure session_id is always stored in MongoDB
    chats_collection.update_one(
        {"session_id": session_id},
        {
            "$setOnInsert": {"session_id": session_id, "user_id": user_id},
            "$push": {"messages": {"$each": chat_data["messages"]}}
        },
        upsert=True
    )

    return jsonify({"response": bot_reply, "session_id": session_id})


# ✅ Fix "New Chat"
@app.route("/chat/new", methods=["POST"])
def new_chat():
    session_id = str(uuid.uuid4())  
    return jsonify({"session_id": session_id})


# ✅ Fix "Clear Chat"
@app.route("/chat/clear/<session_id>", methods=["DELETE"])
def clear_chat(session_id):
    result = chats_collection.update_one(
        {"session_id": session_id},
        {"$set": {"messages": []}}
    )
    if result.modified_count == 0:
        return jsonify({"message": "Chat session not found."}), 404
    return jsonify({"message": "Chat cleared successfully."})


# ✅ Fix "Delete Chat"
@app.route("/chat/delete/<session_id>", methods=["DELETE"])
def delete_chat(session_id):
    result = chats_collection.delete_one({"session_id": session_id})
    if result.deleted_count == 0:
        return jsonify({"message": "Chat session not found."}), 404
    return jsonify({"message": "Chat deleted successfully."})

# ✅ Fix "Edit Chat"
@app.route("/chat/edit", methods=["PUT"])
def edit_chat():
    data = request.json
    session_id = data.get("session_id")
    old_message = data.get("old_message")
    new_message = data.get("new_message")

    if not session_id or not old_message or not new_message:
        return jsonify({"error": "Invalid request parameters."}), 400

    result = chats_collection.update_one(
        {"session_id": session_id, "messages.message": old_message},
        {"$set": {"messages.$.message": new_message}}
    )

    if result.matched_count == 0:
        return jsonify({"error": "Message not found."}), 404

    return jsonify({"message": "Chat edited successfully."})


@app.route("/chat/history/<user_id>", methods=["GET"])
def get_chat_history(user_id):
    """Retrieve all chat sessions for a given user."""
    sessions = list(chats_collection.find({"user_id": user_id}))

    chat_sessions = []
    for session in sessions:
        # ✅ Fix: Check if 'session_id' exists before using it
        session_id = session.get("session_id", None)
        if session_id is None:
            print(f"❌ Missing session_id in MongoDB for session: {session}")
            continue

        chat_sessions.append({
            "session_id": session_id,
            "messages": session.get("messages", [])
        })

    return jsonify({"chat_sessions": chat_sessions})


# ✅ Test MongoDB Connection
MONGO_URI = "mongodb://localhost:27017/chatbot_app"  # Ensure this matches your .env
client = MongoClient(MONGO_URI)
try:
    client.server_info()  # Test connection
    print("✅ MongoDB Connected Successfully!")
except Exception as e:
    print("❌ MongoDB Connection Failed:", e)


if __name__ == "__main__":
    app.run(debug=True, port=8000)