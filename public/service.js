// var ws_url = "ws://localhost:8080";
// var http_url = "http://localhost:8080";
var ws_url = "wss://thegameoftak.herokuapp.com";
var http_url = "https://thegameoftak.herokuapp.com";

angular.module("Tak").service("TakService", [
	"$http", "$httpParamSerializer",
	function ($http, $httpParamSerializer) {

		/* SOCKET */

		var onMessageFunc;
		var socket = new WebSocket(ws_url);

		socket.onopen = function () {
			// yay!
		};

		socket.onmessage = function (event) {
			if (onMessageFunc) {
				onMessageFunc(JSON.parse(event.data));
			}
		};

		var setOnMessageFunc = function (func) {
			onMessageFunc = func;
		};

		var sendChatAllMessage = function (chatMessage) {
			socket.send(JSON.stringify({
				command: "chat_all",
				value: chatMessage
			}));
		}

		/* CREATE GAME */

		var sendGameRequest = function (playerName) {
			socket.send(JSON.stringify({
				command: "create_game",
				value: playerName
			}));
		};

		var sendAcceptGameRequest = function (gameId) {
			socket.send(JSON.stringify({
				command: "accept_game",
				value: gameId
			}));
		};

		var sendRejectGameRequest = function (gameId) {
			socket.send(JSON.stringify({
				command: "reject_game",
				value: gameId
			}));
		};

		var sendMove = function (gameId, move) {
			socket.send(JSON.stringify({
				command: "move",
				value: {
					game_id: gameId,
					move: move
				}
			}));
		};

		/* HTTP */

		var joinAsPlayer = function (playerName, done, failed) {
			$http({
				method: "GET",
				url: http_url + "/player_name/" + playerName,
				headers: {
					"Content-Type": "application/x-www-form-urlencoded"
				}
			}).then(function (response) {
				socket.send(JSON.stringify({
					command: "create",
					value: playerName
				}));
				done();
			}, function (response) {
				if (response.status == 422) {
					failed(1);
				} else {
					failed(2);
				}
			})
		};

		return {
			joinAsPlayer: joinAsPlayer,
			setOnMessageFunc: setOnMessageFunc,
			sendChatAllMessage: sendChatAllMessage,
			sendGameRequest: sendGameRequest,
			sendAcceptGameRequest: sendAcceptGameRequest,
			sendRejectGameRequest: sendRejectGameRequest,
			sendMove: sendMove
		};
	}
]);