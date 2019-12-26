const uuidv4 = require('uuid/v4');

module.exports = function(server) {

    var rooms = [];

    var io = require('socket.io')(server, {
        transports:['websocket'],

    });

    io.on('connection', function(socket) {
        console.log("Connection");

        // 1. 유저가 접속하면 빈 방이 있는지 확인한다
        // 2. 빈 방이 없으면 새로운 방을 하나 만들어서 접속한 유저를 할당한다.
        // 3. 빈 방이 있으면 해당 방으로 유저를 할당한다.
        // 4. 한 방에 두 유저가 존재하면 해당 방의 유저들은 게임을 시작한다.
        // 5. 누군가 접속을 해제하면 그 유저의 방은 게임을 종료한다.

        // 방 만들기
        var createRoom = function() {           // 
            var roomId = uuidv4();              // 방 이름 생성
            socket.join(roomId, function() {
                var room = { roomId: roomId, clients: [{ clientId: socket.id, ready:false }] }
                rooms.push(room);

            });
        }

        // 유효한 방 찾기
        var getAvailableRoomId = function() {
            if (rooms.length > 0) {
                for (var i = 0; i < rooms.length; i++) {
                    if (rooms[i].clients.length < 2) {
                        return i;
                    }
                }
            }
            return -1;
        }

        // 빈방찾기
        var roomIndex = getAvailableRoomId();
        if (roomIndex > -1) {
            // 접속한 유저를 그 방에 보낸다
            socket.join(rooms[roomIndex].roomId, function() {
                var client = { clientId: socket.id, ready: false }
                rooms[roomIndex].clients.push(client);
            })
        } else {
            // 시로운 방을 만들어서 접속한 유저 할당
            createRoom();
        } 

        socket.on('disconnect', function(reason) {
            console.log("Disconnection");
        });
    });
};