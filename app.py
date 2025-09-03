from flask import Flask, render_template, request, redirect, url_for, session
from flask_socketio import SocketIO, join_room, leave_room, emit
from functools import wraps
import uuid
import time

app = Flask(__name__)
app.config['SECRET_KEY'] = 'change-me-in-prod'  # use env var in real apps
socketio = SocketIO(app, async_mode='gevent')
#socketio = SocketIO(app, async_mode='eventlet')

# --- Simple login-required decorator (session-based) ---
def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if 'username' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return wrapper

# --- Views ---
@app.route('/', methods=['GET'])
def index():
    return redirect(url_for('chat') if 'username' in session else 'login')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = (request.form.get('username') or '').strip()
        if username:
            session['username'] = username
            return redirect(url_for('chat'))
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/chat')
@login_required
def chat():
    return render_template('chat.html', username=session['username'])

# --- Socket.IO events ---
@socketio.on('join')
def handle_join(data):
    """
    data: {room: str}
    """
    username = session.get('username', f'guest-{uuid.uuid4().hex[:6]}')
    room = (data.get('room') or 'general').strip() or 'general'

    join_room(room)
    emit('system', {
        'message': f'{username} joined #{room}',
        'room': room,
        'ts': time.time()
    }, to=room)

@socketio.on('leave')
def handle_leave(data):
    username = session.get('username', 'someone')
    room = (data.get('room') or 'general').strip() or 'general'
    leave_room(room)
    emit('system', {
        'message': f'{username} left #{room}',
        'room': room,
        'ts': time.time()
    }, to=room)

@socketio.on('send_message')
def handle_message(data):
    """
    data: {room: str, text: str}
    """
    username = session.get('username', 'anon')
    room = (data.get('room') or 'general').strip() or 'general'
    text = (data.get('text') or '').strip()
    if not text:
        return
    emit('new_message', {
        'id': uuid.uuid4().hex,
        'user': username,
        'text': text,
        'room': room,
        'ts': time.time()
    }, to=room)

# Optional: typing indicator
@socketio.on('typing')
def handle_typing(data):
    username = session.get('username', 'anon')
    room = (data.get('room') or 'general').strip() or 'general'
    emit('typing', {'user': username, 'room': room}, to=room, include_self=False)

if __name__ == '__main__':
    # eventlet web server will be used automatically by socketio.run
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
