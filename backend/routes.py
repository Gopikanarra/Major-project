from flask import Blueprint, request, jsonify

chatbot_routes = Blueprint('chatbot_routes', __name__)

@chatbot_routes.route('/chat', methods=['POST'])
def chat():
    user_message = request.json.get("message", "")
    response = {"reply": f"You said: {user_message}"}
    return jsonify(response)
