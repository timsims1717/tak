// Node.js packages
var express = require("express");
var bodyParser = require("body-parser");
var WebSocket = require("ws");

var app = express();

// Middleware
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: false }));
app.set("port", (process.env.PORT || 8080));

/* ROUTING */

app.get("/player_name/:name", function (req, res) {
	if (findPlayerByName(req.params.name) == null) {
		res.sendStatus(200);
	} else {
		res.sendStatus(422);
	}
});

/* START SERVER */

var server = app.listen(app.get("port"), function () {
	console.log("Server listening on port " + app.get("port") + "...");
});

var wsserver = new WebSocket.Server({ server: server });

/* WEB SOCKET */

var players = [];
/*
player:
	connection
	name
*/
var games = [];
/*
game:
	id
	player1
	player2
	game_state:
		begun
		done
		turn
		turn_number
		board
*/

var findPlayerByName = function (name) {
	var i = 0;
	for (; i < players.length; i++) {
		if (players[i].name == name) {
			return players[i];
		}
	}
	return null;
};

var findPlayerByWS = function (ws) {
	var i = 0;
	for (; i < players.length; i++) {
		if (players[i].connection == ws) {
			return players[i];
		}
	}
	return null;
};

var findIndexOfPlayerByWS = function (ws) {
	var i = 0;
	for (; i < players.length; i++) {
		if (players[i].connection == ws) {
			return i;
		}
	}
	return -1;
};

var findGameById = function (gameId) {
	return games[gameId];
};

var findGameByPlayers = function (player1, player2) {
	var i = 0;
	for (; i < games.length; i++) {
		if (games[i].player1 == player1 && games[i].player2 == player2) {
			return games[i];
		}
	}
	return null;
};

/* MESSAGES */
/*
chat_all: send a chat message to a player
	value: {
		name: the name of the player that sent the message (or server if sent by the server)
		message: the chat message
	}
player_list: send the current list to a player
	value: the list of all current players' names
join_game: send a player a join game request
	value: the player wanting to play
*/

/* PLAYERS */

var chatAll = function (name, message) {
	players.forEach(function (player) {
		if (player.connected) {
			player.connection.send(JSON.stringify({
				command: "chat_all",
				value: {
					name: name,
					message: message
				}
			}));
		}
	});
};

var newPlayer = function (ws, name) {
	players.push({
		connection: ws,
		connected: true,
		name: name
	});
	players.forEach(function (player) {
		if (player.connected) {
			player.connection.send(JSON.stringify({
				command: "chat_all",
				value: {
					name: "Server",
					message: name + " has joined"
				}
			}));
		}
	});
	updateListOfPlayers();
};

var updateListOfPlayers = function () {
	players.forEach(function (player) {
		playerList = [];
		var i = 0;
		for (; i < players.length; i++) {
			if (players[i].name != player.name) {
				playerList.push(players[i].name);
			}
		}
		if (player.connected) {
			player.connection.send(JSON.stringify({
				command: "player_list",
				value: playerList
			}));
		}
	});
};

var playerDisconnected = function (ws) {
	var player = findPlayerByWS(ws);
	if (player != null) {
		player.connected = false;
		return true;
	} else {
		return false;
	}
};

/* GAMES */

var sendCreateGameRequest = function (host, player) {
	var id = games.length;
	games.push({
		id: id,
		player1: host,
		player2: player,
		game_state: {
			begun: false,
			done: false,
			turn: 0,
			board: []
		}
	});
	if (player.connected) {
		player.connection.send(JSON.stringify({
			command: "join_game",
			value: {
				host: host.name,
				game_id: id
			}
		}));
	}
};

var beginGame = function (game) {
	game.game_state.begun = true;
	game.game_state.board = [ [ // row 1
			[0],[0],[0],[0],[0]
		], [ // row 2
			[0],[0],[0],[0],[0]
		], [ // row 3
			[0],[0],[0],[0],[0]
		], [ // row 4
			[0],[0],[0],[0],[0]
		], [ // row 5
			[0],[0],[0],[0],[0]
		]
	];
	game.game_state.turn = 1;
	var response = {
		command: "begin_game",
		value: {
			you: game.player1.name,
			opponent: game.player2.name,
			game_id: game.id,
			game_state: game.game_state,
			your_turn: game.game_state.turn % 2 == 1,
			white: true
		}
	};
	if (game.player1.connected) {
		game.player1.connection.send(JSON.stringify(response));
	}
	response = {
		command: "begin_game",
		value: {
			you: game.player2.name,
			opponent: game.player1.name,
			game_id: game.id,
			game_state: game.game_state,
			your_turn: game.game_state.turn % 2 == 0,
			white: false
		}
	};
	if (game.player2.connected) {
		game.player2.connection.send(JSON.stringify(response));
	}
};

var endGame = function (game, player1, player2) {
	game.game_state.done = true;
	var response = {
		command: "end_game",
		value: {
			you: game.player1.name,
			opponent: game.player2.name,
			game_id: game.id,
			winner: player1
		}
	};
	if (game.player1.connected) {
		game.player1.connection.send(JSON.stringify(response));
	}
	response = {
		command: "end_game",
		value: {
			you: game.player2.name,
			opponent: game.player1.name,
			game_id: game.id,
			winner: player2
		}
	};
	if (game.player2.connected) {
		game.player2.connection.send(JSON.stringify(response));
	}
};

var closeGamesByPlayer = function (ws) {
	var player = findPlayerByWS(ws);
	console.log("closing games for player " + player.name);
	if (player != null) {
		var i = 0;
		for (; i < games.length; i++) {
			if (games[i].player1.name == player.name || games[i].player2.name == player.name) {
				console.log("found a game");
				endGame(games[i], true, true);
			}
		}
	}
};

var makeMove = function (game, player, move) {
	var success = false;
	var whiteMove;
	if (game.player1.name == player.name) {
		whiteMove = true;
	} else {
		whiteMove = false;
	}
	if (!game.game_state.done && game.game_state.begun &&
		(game.game_state.turn % 2 == 1) == whiteMove) {
		var piece = topPiece(game.game_state.board, move.move.r, move.move.c);
		switch (move.code) {
		case "R":
			if (piece == 0) {
				game.game_state.board[move.move.r][move.move.c].push(whiteMove ? 1 : 4);
				success = true;
			}
			break;
		case "W":
			if (piece == 0) {
				game.game_state.board[move.move.r][move.move.c].push(whiteMove ? 2 : 5);
				success = true;
			}
			break;
		case "C":
			if (piece == 0) {
				game.game_state.board[move.move.r][move.move.c].push(whiteMove ? 3 : 6);
				success = true;
			}
			break;
		}
	}
	if (success) {
		game.game_state.turn += 1;
		var winState = analyzeBoard(game.game_state.board);
		if (winState.done) {
			endGame(game, winState.white, winState.black);
			return;
		}
	}
	var response = {
		command: "make_move",
		value: {
			you: game.player1.name,
			opponent: game.player2.name,
			game_id: game.id,
			game_state: game.game_state,
			your_turn: game.game_state.turn % 2 == 1,
			white: true
		}
	};
	if (game.player1.connected) {
		game.player1.connection.send(JSON.stringify(response));
	}
	response = {
		command: "make_move",
		value: {
			you: game.player2.name,
			opponent: game.player1.name,
			game_id: game.id,
			game_state: game.game_state,
			your_turn: game.game_state.turn % 2 == 0,
			white: false
		}
	};
	if (game.player2.connected) {
		game.player2.connection.send(JSON.stringify(response));
	}
};

var analyzeBoard = function (fullboard) {
	console.log("Analyzing board...");
	var whiteWin = false;
	var blackWin = false;
	var board = buildGameEndBoard(fullboard);
	var p = 1;
	outer:
	for (; p < 3; p++) {
		var i = 0;
		for (; i < 5; i++) {
			if (board[0][i] == p) {
				if (dfs(dupBoard(board), 0, i, true, p)) {
					if (p == 1) {
						whiteWin = true;
					} else {
						blackWin = true;
					}
					continue outer;
				}
			}
		}
		i = 0;
		for (; i < 5; i++) {
			if (board[i][0] == p) {
				if (dfs(dupBoard(board), i, 0, false, p)) {
					if (p == 1) {
						whiteWin = true;
					} else {
						blackWin = true;
					}
					continue outer;
				}
			}
		}
	}
	return {
		done: whiteWin || blackWin,
		white: whiteWin,
		black: blackWin
	};
};

var buildGameEndBoard = function (fullboard) {
	var board = [ [ // row 1
			0,0,0,0,0
		], [ // row 2
			0,0,0,0,0
		], [ // row 3
			0,0,0,0,0
		], [ // row 4
			0,0,0,0,0
		], [ // row 5
			0,0,0,0,0
		]
	];
	var i = 0;
	for (; i < 5; i++) {
		var j = 0;
		for (; j < 5; j++) {
			var piece = topPiece(fullboard, i, j);
			if (piece == 1 || piece == 3) {
				board[i][j] = 1;
			} else if (piece == 4 || piece == 6) {
				board[i][j] = 2;
			}
		}
	}
	return board;
};

var dfs = function (board, r, c, vertical, player) {
	board[r][c].visited = true;
	// if we have reached the other end of the board
	if (vertical) {
		if (r == board.length - 1) {
			return true;
		}
	} else {
		if (c == board.length - 1) {
			return true;
		}
	}
	// bottom piece
	if (r < board.length - 1 && board[r+1][c].piece == player && !board[r+1][c].visited) {
		if (dfs(board, r+1, c, vertical, player)) {
			return true;
		}
	}
	// right piece
	if (c < board.length - 1 && board[r][c+1].piece == player && !board[r][c+1].visited) {
		if (dfs(board, r, c+1, vertical, player)) {
			return true;
		}
	}
	// top piece
	if (r > 0 && board[r-1][c].piece == player && !board[r-1][c].visited) {
		if (dfs(board, r-1, c, vertical, player)) {
			return true;
		}
	}
	// left piece
	if (c > 0 && board[r][c-1].piece == player && !board[r][c-1].visited) {
		if (dfs(board, r, c-1, vertical, player)) {
			return true;
		}
	}
	// no luck from this piece
	return false;
};

var dupBoard = function (board) {
	var newBoard = [ [ // row 1
			{},{},{},{},{}
		], [ // row 2
			{},{},{},{},{}
		], [ // row 3
			{},{},{},{},{}
		], [ // row 4
			{},{},{},{},{}
		], [ // row 5
			{},{},{},{},{}
		]
	];
	var i = 0;
	for (; i < 5; i++) {
		var j = 0;
		for (; j < 5; j++) {
			newBoard[i][j] = {
				piece: board[i][j],
				visited: false
			};
		}
	}
	return newBoard;
};

var topPiece = function (board, rIndex, cIndex) {
	var cell = board[rIndex][cIndex];
	if (cell.length == 0) {
		return 0;
	} else {
		return cell[cell.length - 1];
	}
};

// when a new connection is made
wsserver.on("connection", function (ws) {
	console.log("Client connected.");

	ws.on("message", function (message_string) {
		var message = JSON.parse(message_string);
		console.log(message);
		command = message.command;
		if (command == "create") {
			newPlayer(ws, message.value);
		} else if (command == "chat_all") {
			var player = findPlayerByWS(ws);
			chatAll(player.name, message.value);
		} else if (command == "create_game") {
			var host = findPlayerByWS(ws);
			var player = findPlayerByName(message.value);
			sendCreateGameRequest(host, player);
		} else if (command == "accept_game") {
			var player = findPlayerByWS(ws);
			var game = findGameById(message.value);
			beginGame(game);
		} else if (command == "reject_game") {
			var player = findPlayerByWS(ws);
			var game = findGameById(message.value);
			endGame(game);
		} else if (command == "chat_game") {

		} else if (command == "move") {
			var player = findPlayerByWS(ws);
			var game = findGameById(message.value.game_id);
			makeMove(game, player, message.value.move);
		} else if (command == "resign") {

		}
	});

	// when the connection is closed
	ws.on("close", function () {
		console.log("Client disconnected.");
		if (playerDisconnected(ws)) {
			closeGamesByPlayer(ws);
			var index = findIndexOfPlayerByWS(ws);
			if (index > -1) {
				players.splice(index, 1);
				updateListOfPlayers();
			}
		}
	});
});