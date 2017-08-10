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

    if (myMap.has('oppMap')) {
      var data = JSON.stringify({
        'message': msg,
        'sender': 'him'
      })
      broadcast(myMap, data)
    }

    if(myMap.get('isMusician')) addMusiChat(myMap, msg)
    else addChat(myMap, msg)

  }) //ws.on()
}) //router.ws()


function addChat(myMap, msg) {
  var now = moment().format("YYYY-MM-DD HH:mm:ss")
  chatService.insert({
    'muno' : myMap.get('opponent'),
    'mno' : myMap.get('user'),
    'msg' : msg,
    'date' : now,
    'who' : myMap.get('user')
  }, function(result) {
    var data = {
      'message': msg,
      'sender': 'me'
    }
    myMap.get('ws').send(JSON.stringify(data));
  }, function(error) {
    console.log(error)
  })//chatService.insert()
} //addChat()

function addMusiChat(myMap, msg) {
  var now = moment().format("YYYY-MM-DD HH:mm:ss")
  chatService.insert({
    'mno' : myMap.get('opponent'),
    'muno' : myMap.get('user'),
    'msg' : msg,
    'date' : now,
    'who' : myMap.get('user')
  }, function(result) {
    var data = {
      'message': msg,
      'sender': 'me'
    }
    myMap.get('ws').send(JSON.stringify(data));
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
      return;
    }
    console.log('상대는 오프라인');
  } //for()
} //broadcast()

function broadcast(myMap, data) {
  console.log('브로드 캐스트 => ' + myMap.get('opponent') + ', wsID: ' + myMap.get('oppMap').get('ws')._socket._handle.fd);
  myMap.get('oppMap').get('ws').send(data)
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


function getFile(photo) {
  // var path = photo.substring(1);
  var file = fs.createWriteStream("public" + photo + "_80.png");
  var request = http.get("http://192.168.0.22:8080" + photo + "_80.png", function(response) {
    response.pipe(file);
    console.log('file transfer succeed')
  });
}


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


module.exports = router


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
