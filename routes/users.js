var express = require('express');
var router = express.Router();
var crypto = require('crypto');
var mongodb = require('mongodb');

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

/* 유저정보 */
router.get('/info', function(req, res, next) {
  var db = req.app.get('database');

  if (db == undefined) {
    res.status(503).json({message: '503 Server Error'});
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
          res.status(401).json({message: 'Unauthorized'});
        }
    });
  }
  else{
    res.status(401).json({message: 'Unauthorized'});
  }
});

/* 회원가입 */
router.post('/signup', function(req, res, next) {
  var username = req.body.username;
  var password = req.body.password;
  var name = req.body.name;

  var db = req.app.get('database');

  if (db == undefined) {
    res.json({message:'503 Server Error'});
    return;
  }

  var validate = userValidation(username, password);
  if (validate == false) {
    res.json({message:'400 Bad Request'});
    return;
  }

  var usersCollection = db.collection('users');

  usersCollection.count({username:username}, function(err, result) {
    if (err) throw(err);

    if (result > 0) {
      res.json({message: '400 Bad Request'});
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
              res.status(503).json({message: 'Server Error'});
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
    res.json({message:'503 Server Error'});
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
              res.status(204).json({message:'No Content'});
            }
          });
      });
    } else {
      res.json({message:'204 No Content'});
    }
  });
});

// 점수 추가
router.post('/addscore', function(req, res, next) {
  var score = req.body.score;

  var db = req.app.get('database');
  if (db == undefined) {
    res.json({message: '503 Server Error'});
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
        res.status(200).json({message:'No Content'});
      }
    });
  } else {
    // res.json({message:'401 Unauthorized'})
    res.status(401).send('Unauthorized');
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