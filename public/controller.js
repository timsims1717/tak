angular.module("Tak", []);

// controller.js
angular.module("Tak").controller("TakController", [
	"$scope", "TakService",
	function ($scope, TakService) {

		$scope.chatMessages = [];
		$scope.currentPlayers = [];
		$scope.gameStatus = [];
		$scope.disableRequest = [];
		$scope.gameRequests = [];
		$scope.games = [];
		$scope.nextMove = [];
		tempBoard = [];

		TakService.setOnMessageFunc(function (message) {
			console.log(message);
			command = message.command;
			if (command == "chat_all") {
				$scope.chatMessages.push(message.value);
			} else if (command == "player_list") {
				$scope.currentPlayers = message.value;
			} else if (command == "join_game") {
				$scope.gameRequests.push({
					hostName: message.value.host,
					gameId: message.value.game_id
				});
				$scope.joinGameRequest = true;
			} else if (command == "begin_game") {
				createGame(message.value);
			} else if (command == "end_game") {
				removeGame(message.value);
			} else if (command == "make_move") {
				makeMove(message.value);
			}
			$scope.$apply();
		});

		// send button clicked
		$scope.sendChatAllMessage = function () {
			TakService.sendChatAllMessage($scope.chatMessageBox);
			$scope.chatMessageBox = "";
		}

		/* PLAYER CREATION */

		// join button clicked
		$scope.createPlayer = function () {
			console.log("Join button clicked");
			playerName = $scope.inputPlayerName;
			TakService.joinAsPlayer(playerName, function() {
				$scope.playerCreated = true;
				$scope.inputPlayerNameMessage = "";
			}, function (errId) {
				if (errId == 1) {
					$scope.inputPlayerNameMessage = "Someone already has claimed that player name.";
				} else {
					$scope.inputPlayerNameMessage = "An error occurred while trying to join.";
				}
			});
		};

		/* GAME CREATION */

		// play with button clicked
		$scope.sendGameRequest = function (playerName) {
			console.log("Play button clicked: " + playerName);
			$scope.gameStatus[$scope.currentPlayers.indexOf(playerName)] = "sending request...";
			$scope.disableRequest[$scope.currentPlayers.indexOf(playerName)] = true;
			TakService.sendGameRequest(playerName);
		};

		// accept button clicked
		$scope.acceptCreateRequest = function (gameId) {
			console.log("accept button clicked");
			removeGameRequest(gameId);
			TakService.sendAcceptGameRequest(gameId);
		};

		// reject button clicked
		$scope.rejectCreateRequest = function (gameId) {
			console.log("reject button clicked");
			removeGameRequest(gameId);
			TakService.sendRejectGameRequest(gameId);
		};

		var removeGameRequest = function (gameId) {
			var index = -1;
			var i = 0;
			for (; i < $scope.gameRequests.length; i++) {
				if ($scope.gameRequests[i].gameId == gameId) {
					index = i;
					break;
				}
			}
			if (index > -1) {
				$scope.gameRequests.splice(index, 1);
			}
			if ($scope.gameRequests.length == 0) {
				$scope.joinGameRequest = false;
			}
		};

		var createGame = function (game) {
			$scope.gameStatus[$scope.currentPlayers.indexOf(game.opponent)] = "in progress...";
			$scope.disableRequest[$scope.currentPlayers.indexOf(game.opponent)] = true;
			$scope.games.push(game);
			$scope.nextMove.push({
				move: {},
				ready: false
			});
			tempBoard.push([ [ // row 1
					-1,-1,-1,-1,-1
				], [ // row 2
					-1,-1,-1,-1,-1
				], [ // row 3
					-1,-1,-1,-1,-1
				], [ // row 4
					-1,-1,-1,-1,-1
				], [ // row 5
					-1,-1,-1,-1,-1
				]
			]);
		};

		/* GAME PLAY */

		$scope.topPieceClass = function (gIndex, rIndex, cIndex) {
			var tempPiece = tempBoard[gIndex][rIndex][cIndex];
			if (tempPiece == -1) {
				tempPiece = $scope.topPiece(gIndex, rIndex, cIndex);
			}
			switch (tempPiece) {
			case 1:
				return "white-road";
			case 2:
				return "white-wall";
			case 3:
				return "white-cap";
			case 4:
				return "black-road";
			case 5:
				return "black-wall";
			case 6:
				return "black-cap";
			default:
				return "empty";
			}
		};

		$scope.topPiece = function (gIndex, rIndex, cIndex) {
			var cell = $scope.games[gIndex].game_state.board[rIndex][cIndex];
			if (cell.length == 0) {
				return 0;
			} else {
				return cell[cell.length - 1];
			}
		};

		$scope.setPiece = function (gIndex, rIndex, cIndex) {
			console.log("setPiece clicked: g = " + gIndex + ", r = " + rIndex + ", c = " + cIndex);
			var game = $scope.games[gIndex];
			if (game.your_turn && !game.game_state.done) {
				if ($scope.topPiece(gIndex, rIndex, cIndex) == 0) {
					var tempPiece = tempBoard[gIndex][rIndex][cIndex];
					switch (tempPiece) {
					case -1:
						resetTempBoard(gIndex);
						tempBoard[gIndex][rIndex][cIndex] = game.white ? 1 : 4;
						$scope.nextMove[gIndex].move = {
							code: "R",
							move: {
								r: rIndex,
								c: cIndex
							}
						};
						$scope.nextMove[gIndex].ready = true;
						break;
					case 1:
					case 4:
						tempBoard[gIndex][rIndex][cIndex] = game.white ? 2 : 5;
						$scope.nextMove[gIndex].move = {
							code: "W",
							move: {
								r: rIndex,
								c: cIndex
							}
						};;
						$scope.nextMove[gIndex].ready = true;
						break;
					case 2:
					case 5:
						tempBoard[gIndex][rIndex][cIndex] = game.white ? 3 : 6;
						$scope.nextMove[gIndex].move = {
							code: "C",
							move: {
								r: rIndex,
								c: cIndex
							}
						};;
						$scope.nextMove[gIndex].ready = true;
						break;
					case 3:
					case 6:
						resetTempBoard(gIndex);
						break;
					}
				}
			}
		};

		var resetTempBoard = function (gIndex) {
			tempBoard[gIndex] = [ [ // row 1
					-1,-1,-1,-1,-1
				], [ // row 2
					-1,-1,-1,-1,-1
				], [ // row 3
					-1,-1,-1,-1,-1
				], [ // row 4
					-1,-1,-1,-1,-1
				], [ // row 5
					-1,-1,-1,-1,-1
				]
			];
			$scope.nextMove[gIndex].move = {};
			$scope.nextMove[gIndex].ready = false;
		};

		$scope.submitMove = function (gIndex) {
			console.log("Move: " + $scope.nextMove[gIndex].move);
			var game = $scope.games[gIndex];
			var move = $scope.nextMove[gIndex].move;
			TakService.sendMove(game.game_id, move);
		};

		$scope.cancelMove = function (gIndex) {
			resetTempBoard(gIndex);
		};

		var makeMove = function (game) {
			var i = findGameById(game.game_id);
			if (i != -1) {
				$scope.games[i] = game;
				resetTempBoard(i);
			}
		};

		var findGameById = function (gameId) {
			var index = -1;
			var i = 0;
			for (; i < $scope.games.length; i++) {
				if ($scope.games[i].game_id == gameId) {
					index = i;
					break;
				}
			}
			return i;
		};

		/* GAME END */

		var removeGame = function (game) {
			$scope.gameStatus[$scope.currentPlayers.indexOf(game.opponent)] = game.winner ? "You win!" : "You lost!";
			$scope.disableRequest[$scope.currentPlayers.indexOf(game.opponent)] = false;
			var index = -1;
			var i = 0;
			for (; i < $scope.games.length; i++) {
				if ($scope.games[i].game_id == game.game_id) {
					index = i;
					break;
				}
			}
			if (index > -1) {
				$scope.games.splice(index, 1);
				$scope.nextMove.splice(index, 1);
				tempBoard.splice(index, 1);
			}
		};
	}
]);