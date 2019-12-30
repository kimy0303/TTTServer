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
        var createRoom = function() {
            var roomId = uuidv4();              // 방 이름 생성
            socket.join(roomId, function() {
                var room = { roomId: roomId, clients: [{ clientId: socket.id, ready:false }] }
                rooms.push(room);

                socket.emit('join', { roomId: roomId, clientId: socket.id });

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

                socket.emit('join', { roomId: rooms[roomIndex].roomId, clientId: socket.id });
            })
        } else {
            // 시로운 방을 만들어서 접속한 유저 할당
            createRoom();
        } 

        // 클라이언트가 Ready 되면 호출되는이벤트
        socket.on('ready', function(data) 
        {
            if (!data) return;

            var room = rooms.find(room => room.roomId === data.roomId);

            if (room)
            {
                var clients = room.clients;
                var client = clients.find(client => client.clientId === data.clientId);
                if (client) client.ready = true;
                // 방 안에 모두가 true이면 게임 시작
                if (clients.length == 2)
                {
                    if (clients[0].ready == true && clients[1].ready == true)
                    {
                        // io.in(room.roomId).emit('play', { first: clients[0].clientId });

                        io.to(clients[0].clientId).emit('play', { first: true});
                        io.to(clients[1].clientId).emit('play', { first: false});

                    }
                }
            }
        });

        socket.on('select', function(data) {
            if (!data) return;
            var index = data.index;
            var roomId = data.roomId;
            if (index > -1 && roomId)
            {
                socket.to(roomId).emit('selected', { index: index });
            }
        });

        // 클라이언트가 승리했을때
        socket.on('win', function(data) {
            if (!data) return;
            var roomId = data.roomId;
            var index = data.index;
            if (index > -1 && roomId)
            {
                socket.to(roomId).emit('lose', { index: index });

            }
        });

        // 클라이언트가 무승부
        socket.on('tie', function(data) {
            if (!data) return;
            var roomId = data.roomId;
            var index = data.index;
            if (index > -1 && roomId)
            {
                socket.to(roomId).emit('tie', { index: index });
                
            }
        });

        socket.on('disconnect', function(reason) {
            console.log("Disconnection");

            for (var i = 0; i < rooms.length; i++)
            {
                var client = rooms[i].clients.find(client => client.clientId === socket.id);
                if (client)
                {
                    var clientIndex = rooms[i].clients.indexOf(client);
                    rooms[i].clients.splice(clientIndex, 1);

                    if (rooms[i].clients.length == 0)
                    {
                        var roomIndex = room.indexOf(rooms[i]);
                        rooms.splice(roomIndex, 1);
                    }
                }
            }
        });

    });
};