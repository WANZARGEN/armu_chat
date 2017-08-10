var moment = require('moment');
moment().format();

const express = require('express')
const datasource = require('../util/datasource')
const chatDao = require('../dao/chat-dao')
const chatService = require('../service/chat-service')

var fs = require('fs'),
    path = require('path'),
    http = require('http');

const connection = datasource.getConnection()
chatDao.setConnection(connection)
chatService.setChatDao(chatDao)

const router = express.Router()

var clients = []

var userInfos = []

router.ws('/send.json', function(ws, req) {
  var myMap = new Map;
  clients.push(myMap)
  console.log('연결됨');

  ws.on('message', function(str) {
    var obj = JSON.parse(str),
      msg = obj.message;

    if (!myMap.has('user')) {
      var receiver = obj.receiver,
        sender = obj.sender,
        isMusician = obj.isMusician;
      myMap.set('user', sender)
      myMap.set('ws', ws)
      myMap.set('opponent', receiver)
      myMap.set('isMusician', (isMusician == 'Y' ? true : false))
      console.log('새로운 유저!\n유저 넘버: ' + myMap.get('user') +
        ', wsID: ' + myMap.get('ws')._socket._handle.fd +
        ', 상대방 넘버: ' + myMap.get('opponent'));
      setCommunicator(myMap)
      return;
    }

    var now = moment().format("YYYY-MM-DD HH:mm:ss")
    if (myMap.has('oppMap')) {
      var data = JSON.stringify({
        'message': msg,
        'sender': 'him',
        'readChange': 'N',
        'time': now
      })
      broadcast(myMap, data)
    }

    if(myMap.get('isMusician')) addMusiChat(myMap, msg, myMap.has('oppMap'), now)
    else addChat(myMap, msg, myMap.has('oppMap'), now)

  }) //ws.on()
}) //router.ws()


function addChat(myMap, msg, isRead, now) {
  chatService.insert({
    'muno' : myMap.get('opponent'),
    'mno' : myMap.get('user'),
    'msg' : msg,
    'date' : now,
    'who' : myMap.get('user'),
    'isread' : isRead ? 'Y' : 'N'
  }, function(result) {

  }, function(error) {
    console.log(error)
  })//chatService.insert()
} //addChat()

function addMusiChat(myMap, msg, isRead, now) {
  chatService.insert({
    'mno' : myMap.get('opponent'),
    'muno' : myMap.get('user'),
    'msg' : msg,
    'date' : now,
    'who' : myMap.get('user'),
    'isread' : isRead ? 'Y' : 'N'
  }, function(result) {

  }, function(error) {
    console.log(error)
  })//chatService.insert()
} //addChat()


function setCommunicator(myMap) {
  var oppMap;
  for (var i = 0; i < clients.length; i++) {
    oppMap = clients[i]
    if ((oppMap.get('opponent') == myMap.get('user')) && (oppMap.get('user') == myMap.get('opponent'))) {
      console.log('상대도 온라인 상태');
      myMap.set('oppMap', oppMap)
      oppMap.set('oppMap', myMap)
      updateReadState(myMap)
      // var obj = {'read' = 'Y'}
      // myMap.get('ws').send(JSON.stringify(obj))
      return;
    }
    console.log('상대는 오프라인');
  } //for()
} //broadcast()

function broadcast(myMap, data) {
  console.log('브로드 캐스트 => ' + myMap.get('opponent'));
  var userMap = myMap.get('oppMap')
    userMap.get('ws').send(data)
}


function updateReadState(myMap) {
  var data = {
    'sender': 'him',
    'readChange': 'Y'
    };

  if(myMap.get('isMusician')) {
    chatService.update(myMap.get('opponent'), myMap.get('user'), function(result) {
      console.log('읽음정보 업데이트됨')
      broadcast(myMap, JSON.stringify(data))
      myMap.get('ws').send(JSON.stringify(data))
    }, function(error) {
      res.status(200)
        .set('Content-Type', 'text/plain;charset=UTF-8')
        .end('error')
      console.log(error)
    })
  } else {
    chatService.update(myMap.get('user'), myMap.get('opponent'), function(result) {
      console.log('읽음정보 업데이트됨')
      broadcast(myMap, JSON.stringify(data))
      myMap.get('ws').send(JSON.stringify(data))
    }, function(error) {
      res.status(200)
        .set('Content-Type', 'text/plain;charset=UTF-8')
        .end('error')
      console.log(error)
    })
  }
}


router.post('/list.json', (req, res) => {
  getFile(req.body.photo)
  chatService.list(req.body.senderNo, req.body.receiverNo, function(results) {
    res.json({
      'list': results
    })
  }, function(error) {
    res.status(200)
      .set('Content-Type', 'text/plain;charset=UTF-8')
      .end('error')
    console.log(error)
  })
})

router.post('/listMusi.json', (req, res) => {
  chatService.listMusi(req.body.receiverNo, req.body.senderNo, function(results) {
    getFile(req.body.photo)
    res.json({
      'list': results
    })
  }, function(error) {
    res.status(200)
      .set('Content-Type', 'text/plain;charset=UTF-8')
      .end('error')
    console.log(error)
  })
})

router.post('/getPhotoPath.json', (req, res) => {
  chatService.getPhotoPath(req.body.no, function(result) {
    res.json({
      'photo': result[0].path
    })
  }, function(error) {
    res.status(200)
      .set('Content-Type', 'text/plain;charset=UTF-8')
      .end('error')
    console.log(error)
  })
})

router.post('/quit.json', (req, res) => {
  var result = removeClient(req.body.no)
  console.log(req.body.no + '퇴장! >> ' + result)
  console.log('---------------- 현재 클라이언트 목록 ----------------')
  console.log(clients)
  console.log('------------------------------------------------------')
  res.json({
    'state': result
  })
})

function getFile(photo) {
  // var path = photo.substring(1);
  var file = fs.createWriteStream("public" + photo + "_80.png");
  var request = http.get("http://192.168.0.22:8080" + photo + "_80.png", function(response) {
    response.pipe(file);
    console.log('file transfer succeed')
  });
}

function removeClient(no) {
  var result;
  for (var i = 0; i < clients.length; i++) {
    if(clients[i].get('user') == no) {
      clients.splice(i, i + 1)
      result = 'removed from client list '
      break;
    }
  }

  for (var j = 0; j < clients.length; j++) {
    if(clients[j].get('opponent') == no) {
      var data = {"exit": "exit"}
      clients[j].get('ws').send(JSON.stringify(data))
      clients[j].delete('oppMap')
      result += "and from opponent's map"
      break;
    }
  }

  return result;
}

module.exports = router





// var filePath = 'c:/book/discovery.docx';
// fs.unlinkSync(filePath);


// function ensureDirectoryExistence(filePath) {
// var dirname = path.dirname(filePath);
// if (fs.existsSync(dirname)) {
//   return true;
// }
// ensureDirectoryExistence(dirname);
// fs.mkdirSync(dirname);
// }

//
// router.post('/change.json', (req, res) => {
//   console.log(req.body.senderNo)
//   console.log(req.body.receiverNo)
//   // var map = setUser(req.body.senderNo, req.body.receiverNo, '잠시만')
//   // userInfos.push(map)
//
//   // res.json({
//   //   'location': 'http://192.168.0.22:8888/mobile/chat/chat-msg.html'
//   // })
//
//   res.redirect('http://192.168.0.22:8888/mobile/chat/chat-msg.html')
//   next
// })
//
//
// function setUser(senderNo, receiverNo, nickName) {
//   for(var userMap in userInfos) {
//     if(userMap.get('senderNo') == senderNo && userMap.get('receiverNo') == receiverNo){
//       return userMap
//     }
//     else {
//       var newMap = new Map()
//       newMap.set('senderNo', senderNo)
//       newMap.set('receiverNo', receiverNo)
//       newMap.set('nickName', nickName)
//       return newMap
//     }
//   }
// }
