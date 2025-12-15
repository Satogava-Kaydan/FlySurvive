// game.js
class TicTacToeGame {
    constructor() {
        this.socket = io();
        this.playerSymbol = null;
        this.roomId = null;
        this.isMyTurn = false;
        this.gameLink = null;
        
        this.initElements();
        this.initEventListeners();
        this.initSocketEvents();
        
        // Проверяем параметр комнаты в URL
        this.checkUrlForRoom();
    }

    initElements() {
        // Основные элементы
        this.lobby = document.getElementById('lobby');
        this.gameRoom = document.getElementById('gameRoom');
        this.chatBox = document.getElementById('chatBox');
        this.gameBoard = document.getElementById('gameBoard');
        this.chatMessages = document.getElementById('chatMessages');
        
        // Кнопки и инпуты
        this.createRoomBtn = document.getElementById('createRoomBtn');
        this.joinRoomBtn = document.getElementById('joinRoomBtn');
        this.roomIdInput = document.getElementById('roomIdInput');
        this.restartBtn = document.getElementById('restartBtn');
        this.leaveRoomBtn = document.getElementById('leaveRoomBtn');
        this.chatInput = document.getElementById('chatInput');
        this.sendMessageBtn = document.getElementById('sendMessageBtn');
        this.copyLinkBtn = document.getElementById('copyLinkBtn');
        
        // Информационные элементы
        this.roomIdDisplay = document.getElementById('roomIdDisplay');
        this.gameStatus = document.getElementById('gameStatus');
        this.playerSymbolDisplay = document.getElementById('playerSymbol');
        this.currentPlayerDisplay = document.getElementById('currentPlayer');
        this.notification = document.getElementById('notification');
        this.gameLinkDisplay = document.getElementById('gameLinkDisplay');
        
        // Создаем кнопку копирования ссылки, если ее нет
        if (!this.copyLinkBtn) {
            const copyBtn = document.createElement('button');
            copyBtn.id = 'copyLinkBtn';
            copyBtn.className = 'btn btn-success';
            copyBtn.innerHTML = '<i class="fas fa-copy"></i> Копировать ссылку';
            copyBtn.style.marginTop = '10px';
            document.querySelector('.room-info').appendChild(copyBtn);
            this.copyLinkBtn = copyBtn;
        }
        
        // Создаем поле для отображения ссылки, если его нет
        if (!this.gameLinkDisplay) {
            const linkDisplay = document.createElement('div');
            linkDisplay.id = 'gameLinkDisplay';
            linkDisplay.className = 'game-link';
            linkDisplay.style.marginTop = '10px';
            linkDisplay.style.wordBreak = 'break-all';
            linkDisplay.style.padding = '10px';
            linkDisplay.style.background = '#f0f8ff';
            linkDisplay.style.borderRadius = '5px';
            document.querySelector('.room-info').appendChild(linkDisplay);
            this.gameLinkDisplay = linkDisplay;
        }
        
        // Инициализация игрового поля
        this.createBoard();
    }

    checkUrlForRoom() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room');
        
        if (roomId) {
            this.roomIdInput.value = roomId;
            this.showNotification(`Найдена комната в URL: ${roomId}`, 'info');
        }
    }

    createBoard() {
        this.gameBoard.innerHTML = '';
        for (let i = 0; i < 9; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.index = i;
            cell.addEventListener('click', () => this.makeMove(i));
            this.gameBoard.appendChild(cell);
        }
    }

    initEventListeners() {
        // Создание комнаты
        this.createRoomBtn.addEventListener('click', () => {
            this.socket.emit('createRoom');
            this.showNotification('Создание комнаты...', 'info');
        });

        // Присоединение к комнате
        this.joinRoomBtn.addEventListener('click', () => {
            const roomId = this.roomIdInput.value.trim().toUpperCase();
            if (roomId) {
                this.socket.emit('joinRoom', roomId);
                this.showNotification(`Присоединение к комнате ${roomId}...`, 'info');
            } else {
                this.showNotification('Введите ID комнаты', 'warning');
            }
        });

        // Перезапуск игры
        this.restartBtn.addEventListener('click', () => {
            if (this.roomId) {
                this.socket.emit('restartGame', this.roomId);
            }
        });

        // Выход из комнаты
        this.leaveRoomBtn.addEventListener('click', () => {
            this.leaveRoom();
        });

        // Копирование ссылки
        this.copyLinkBtn.addEventListener('click', () => {
            this.copyGameLink();
        });

        // Отправка сообщения
        this.sendMessageBtn.addEventListener('click', () => this.sendMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
    }

    initSocketEvents() {
        // Подключение к серверу
        this.socket.on('connect', () => {
            console.log('✅ Подключен к серверу. ID:', this.socket.id);
            this.addSystemMessage('Подключено к игровому серверу');
        });

        // Ошибка подключения
        this.socket.on('connect_error', (error) => {
            console.error('❌ Ошибка подключения:', error);
            this.showNotification('Ошибка подключения к серверу', 'error');
        });

        // Комната создана
        this.socket.on('roomCreated', (data) => {
            this.roomId = data.roomId;
            this.gameLink = data.gameLink;
            
            this.showScreen('game');
            this.roomIdDisplay.textContent = data.roomId;
            this.gameStatus.textContent = 'Ожидание второго игрока...';
            
            // Отображаем ссылку
            this.gameLinkDisplay.innerHTML = `
                <strong>Ссылка для друга:</strong><br>
                <a href="${data.gameLink}" target="_blank">${data.gameLink}</a>
            `;
            
            // Показываем в консоли браузера
            console.log('\n' + '='.repeat(50));
            console.log('🎮 ССЫЛКА НА ИГРУ СОЗДАНА!');
            console.log('='.repeat(50));
            console.log(`📋 ID комнаты: ${data.roomId}`);
            console.log(`🔗 Ссылка для друга: ${data.gameLink}`);
            console.log('📱 Скопируйте эту ссылку и отправьте другу');
            console.log('='.repeat(50) + '\n');
            
            this.showNotification('Комната создана! Скопируйте ссылку для друга', 'success');
            this.addSystemMessage(`Комната создана! Отправьте эту ссылку другу: ${data.gameLink}`);
            
            // Автоматически копируем в буфер обмена
            this.copyToClipboard(data.gameLink);
        });

        // Комната присоединена
        this.socket.on('roomJoined', (data) => {
            this.roomId = data.roomId;
            this.gameLink = data.gameLink;
            
            this.showScreen('game');
            this.roomIdDisplay.textContent = data.roomId;
            
            // Отображаем ссылку
            this.gameLinkDisplay.innerHTML = `
                <strong>Ссылка на игру:</strong><br>
                <a href="${data.gameLink}" target="_blank">${data.gameLink}</a>
            `;
            
            console.log('\n' + '='.repeat(50));
            console.log('🎯 ВЫ ПРИСОЕДИНИЛИСЬ К ИГРЕ!');
            console.log('='.repeat(50));
            console.log(`📋 ID комнаты: ${data.roomId}`);
            console.log(`🔗 Ссылка на игру: ${data.gameLink}`);
            console.log('='.repeat(50) + '\n');
            
            this.addSystemMessage(`Вы присоединились к комнате ${data.roomId}`);
        });

        // Назначение символа
        this.socket.on('assignSymbol', (symbol) => {
            this.playerSymbol = symbol;
            this.playerSymbolDisplay.textContent = symbol;
            this.playerSymbolDisplay.className = symbol === 'X' ? 'symbol-x' : 'symbol-o';
            this.addSystemMessage(`Вы играете за ${symbol}`);
        });

        // Игра началась
        this.socket.on('gameStart', (data) => {
            this.gameStatus.textContent = 'Игра началась!';
            this.updateBoard(data.board);
            this.updateCurrentPlayer(data.currentPlayer);
            this.addSystemMessage('Игра началась!');
        });

        // Обновление игры
        this.socket.on('updateGame', (data) => {
            this.updateBoard(data.board);
            this.updateCurrentPlayer(data.currentPlayer);
        });

        // Конец игры
        this.socket.on('gameOver', (data) => {
            let message = '';
            if (data.winner === 'draw') {
                message = 'Ничья!';
                this.gameStatus.textContent = 'Ничья!';
            } else {
                message = `Победитель: ${data.winner}`;
                this.gameStatus.textContent = `Победитель: ${data.winner}`;
            }
            
            this.updateBoard(data.board);
            this.highlightWinningCells(data.board);
            this.showNotification(message, data.winner === this.playerSymbol ? 'success' : 'info');
            this.addSystemMessage(message);
        });

        // Перезапуск игры
        this.socket.on('gameRestart', (data) => {
            this.updateBoard(data.board);
            this.updateCurrentPlayer(data.currentPlayer);
            this.gameStatus.textContent = 'Игра началась!';
            this.clearBoardHighlights();
            this.addSystemMessage('Игра перезапущена.');
        });

        // Противник отключился
        this.socket.on('opponentDisconnected', () => {
            this.gameStatus.textContent = 'Противник отключился';
            this.showNotification('Противник отключился', 'warning');
            this.addSystemMessage('Противник отключился. Ожидание нового игрока...');
        });

        // Системные сообщения
        this.socket.on('systemMessage', (data) => {
            if (data.text) {
                this.addSystemMessage(data.text);
            }
            if (data.link) {
                console.log(`🔗 Ссылка на игру: ${data.link}`);
            }
        });

        // Ошибка
        this.socket.on('error', (data) => {
            this.showNotification(data.message || 'Ошибка', 'error');
        });
    }

    copyGameLink() {
        if (this.gameLink) {
            this.copyToClipboard(this.gameLink);
            this.showNotification('Ссылка скопирована в буфер обмена!', 'success');
        } else {
            this.showNotification('Ссылка не создана', 'warning');
        }
    }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            console.log('✅ Ссылка скопирована:', text);
        }).catch(err => {
            console.error('❌ Ошибка копирования:', err);
            // Альтернативный метод
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        });
    }

    makeMove(cellIndex) {
        if (!this.isMyTurn || !this.playerSymbol || !this.roomId) return;
        
        const cell = document.querySelector(`.cell[data-index="${cellIndex}"]`);
        if (cell.textContent !== '') return;
        
        this.socket.emit('makeMove', {
            roomId: this.roomId,
            cellIndex: cellIndex,
            symbol: this.playerSymbol
        });
    }

    updateBoard(board) {
        const cells = document.querySelectorAll('.cell');
        cells.forEach((cell, index) => {
            cell.textContent = board[index] || '';
            cell.className = 'cell';
            if (board[index] === 'X') {
                cell.classList.add('x');
            } else if (board[index] === 'O') {
                cell.classList.add('o');
            }
        });
    }

    updateCurrentPlayer(currentPlayer) {
        this.currentPlayerDisplay.textContent = currentPlayer;
        this.currentPlayerDisplay.className = currentPlayer === 'X' ? 'symbol-x' : 'symbol-o';
        this.isMyTurn = currentPlayer === this.playerSymbol;
        
        if (this.isMyTurn) {
            this.gameStatus.textContent = 'Ваш ход!';
        } else {
            this.gameStatus.textContent = 'Ход противника...';
        }
    }

    highlightWinningCells(board) {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];

        for (const pattern of winPatterns) {
            const [a, b, c] = pattern;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                pattern.forEach(index => {
                    const cell = document.querySelector(`.cell[data-index="${index}"]`);
                    cell.style.backgroundColor = '#e8f5e9';
                    cell.style.boxShadow = '0 0 10px rgba(76, 175, 80, 0.5)';
                });
                break;
            }
        }
    }

    clearBoardHighlights() {
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => {
            cell.style.backgroundColor = '';
            cell.style.boxShadow = '';
        });
    }

    showScreen(screen) {
        this.lobby.classList.add('hidden');
        this.gameRoom.classList.remove('hidden');
        this.chatBox.classList.remove('hidden');
    }

    leaveRoom() {
        this.lobby.classList.remove('hidden');
        this.gameRoom.classList.add('hidden');
        this.chatBox.classList.add('hidden');
        
        this.playerSymbol = null;
        this.roomId = null;
        this.isMyTurn = false;
        this.gameLink = null;
        
        this.roomIdInput.value = '';
        this.gameLinkDisplay.innerHTML = '';
        this.createBoard();
        this.chatMessages.innerHTML = '<div class="message system">Добро пожаловать в игру!</div>';
        
        this.addSystemMessage('Вы покинули комнату.');
        this.showNotification('Вы покинули комнату', 'info');
    }

    sendMessage() {
        const message = this.chatInput.value.trim();
        if (message && this.roomId) {
            this.addMessage('Вы', message, 'player');
            this.chatInput.value = '';
        }
    }

    addMessage(sender, text, type = 'player') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.innerHTML = `<strong>${sender}:</strong> ${text}`;
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    addSystemMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system';
        messageDiv.textContent = text;
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    showNotification(message, type = 'info') {
        const notification = this.notification;
        notification.textContent = message;
        notification.className = 'notification';
        
        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            warning: '#ff9800',
            info: '#2196F3'
        };
        
        notification.style.backgroundColor = colors[type] || '#333';
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
}

// Инициализация игры при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new TicTacToeGame();
    
    // Добавляем стили для ссылки
    const style = document.createElement('style');
    style.textContent = 
        .game-link a {
            color: #2196F3;
            text-decoration: none;
            font-weight: bold;
        }
        .game-link a:hover {
            text-decoration: underline;
        }
        #copyLinkBtn {
            margin-top: 10px;
            background: #4CAF50;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 5px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        #copyLinkBtn:hover {
            background: #45a049;
        }
    ;
    document.head.appendChild(style);
});