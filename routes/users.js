var express = require('express');
var router = express.Router();
var crypto = require('crypto');
var mongodb = require('mongodb');

/* 유저정보 */
router.get('/info', function(req, res, next) {
  var db = req.app.get('database');

  if (db == undefined) {
    res.status(503).json({message: '서버 오류가 발생했습니다'});
    return;
  }

  var userId = req.session.user_id;

  if (userId) {
    var usersCollection = db.collection('users');
    usersCollection.findOne({_id: mongodb.ObjectID(userId)}, 
      {projection: {_id: false, name: true, score: true}},
      function(err, result) {
        
        if (err) throw(err);
        if (result) {
          var resultStr = JSON.stringify(result);
          res.status(200).json({message: resultStr});
        } else {
          res.status(401).json({message: '로그인이 필요합니다.'});
        }
    });
  }
  else{
    res.status(401).json({message: '로그인이 필요합니다.'});
  }
});

/* 회원가입 */
router.post('/signup', function(req, res, next) {
  var username = req.body.username;
  var password = req.body.password;
  var name = req.body.name;

  var db = req.app.get('database');

  if (db == undefined) {
    res.json({message:'서버 오류가 발생했습니다'});
    return;
  }

  var validate = userValidation(username, password);
  if (validate == false) {
    res.status(400).json({message:'유효하지 않은 정보를 입력했습니다.'});
    return;
  }

  var usersCollection = db.collection('users');

  usersCollection.count({username:username}, function(err, result) {
    if (err) throw(err);

    if (result > 0) {
      res.status(400).json({message: '이미 동일한 유저가 존재합니다.ㅋ'});
      return;
    } else {
      crypto.randomBytes(64, function(err, buf) {
        const saltStr = buf.toString('base64');
        crypto.pbkdf2(password, saltStr, 102391, 64, 'sha512', function(err, key) {
          const cryptoPassword = key.toString('base64');
    
          usersCollection.insertOne({username: username, password: cryptoPassword, 
            name: name, salt: saltStr, score: 0}, function(err, result) {
            if (err) throw(err);
            if (result.ops.length > 0) {
              req.session.user_id = result.insertedId.toString();

              var resultObj = {name:name, score:0};
              var resultStr = JSON.stringify(resultObj);

              res.status(200).json({message: resultStr});
            } else {
              res.status(503).json({message: '서버 오류가 발생했습니다.'});
            }
          });
        });  
      });
    }
  });
});

/* 로그아웃 */
router.get('/logout', function(req, res, next) {
  req.session.destroy(function(err) {
    res.clearCookie('connect.sid');
    res.status(200).json({message:'Ok'});
  });
});

/* 로그인 */
router.post('/signin', function(req, res, next) {
  var username = req.body.username;
  var password = req.body.password;

  var db = req.app.get('database');

  if (db == undefined) {
    res.status(503).json({message:'서버 오류가 발생했습니다.'});
    return;
  }

  var usersCollection = db.collection('users');

  usersCollection.findOne({username: username}, function(err, result) {
    if (err) throw(err);
    if (result) {
      var saltStr = result.salt;
      crypto.pbkdf2(password, saltStr, 102391, 64, 'sha512', function(err, key) {
        var cryptoPassword = key.toString('base64');

        usersCollection.findOne({username: username, password: cryptoPassword},
          {projection: {name: true, score: true}},
          function(err, result) {
            if (err) throw(err);
            if (result) {
              req.session.regenerate(function(err) {
                req.session.user_id = result._id.toString();
                var resultObj = {'name':result.name, 'score':result.score};
                var resultStr = JSON.stringify(resultObj);
                res.status(200).json({message:resultStr});        
              });
                    
            } else {
              res.status(404).json({message:'비밀번호가 틀렸습니다.'});
            }
          });
      });
    } else {
      res.status(404).json({message:'해당 계정이 없습니다.'});
    }
  });
});

// 점수 추가
router.post('/addscore', function(req, res, next) {
  var score = req.body.score;

  var db = req.app.get('database');
  if (db == undefined) {
    res.status(503).json({message: '서버 오류가 발생했습니다.'});
    return;
  }

  var userId = req.session.user_id;

  if (userId) {
    var usersCollection = db.collection('users');
    usersCollection.findOneAndUpdate({_id:mongodb.ObjectID(userId)}, {$inc:{score:score}}, {returnOriginal:false}, function(err, result) {
      if (err) throw(err);

      var resultObj = { name: result.value.name, score: result.value.score};
      var resultStr = JSON.stringify(resultObj);

      if (result) {
        res.status(200).json({message:resultStr});
      } else {
        res.status(503).json({message:'서버 오류가 발생했습니다.'});
      }
    });
  } else {
    // res.json({message:'401 Unauthorized'})
    res.status(401).send('로그인이 필요합니다');
  }
});

var userValidation = function(username, password) {
  if (username == '' || password == '') {
    return false;
  }
  if (username.length < 4 || username.length > 12) {
    return false;
  }
  if (password.length < 4 || password.length > 12) {
    return false;
  }
  return true;
}

module.exports = router;