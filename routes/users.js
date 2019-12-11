var express = require('express');
var router = express.Router();
var crypto = require('crypto');
var mongodb = require('mongodb');

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

/*회원가입*/
router.post('/signup', function(req, res, next){
  // username, password, name

  var username = req.body.username;
  var password = req.body.password;
  var name = req.body.name;
  
  var db = req.app.get('database');

  if(db == undefined)
  {
    res.json({message:'503 Server Error'});
    return;
  }
  
  var validate = userValidation(username, password);
  if (validate == false){
    res.json({message:'400 Bad Request'})
    return;
  }

  var cryptoPassword = crypto.createHash('sha512').update(password).digest('base64');

  var usersCollection = db.collection('users');

  usersCollection.count({'username':username}, function(err, result) {
    if (err) throw(err);

    if (result > 0) {
      res.json({message: '400 Bad Request'});
      return;
    } else {
      // var cryptoPassword = crypto.createHash('sha512').update(password).digest('base64');

      crypto.randomBytes(64, function(err, buf){
        const saltStr = buf.toString('base64');
        crypto.pbkdf2(password, saltStr, 1031, 64, 'sha512', function(err,key) {
          const cryptoPassword = key.toString('base64');

          usersCollection.insertOne({'username': username,
          'password': cryptoPassword, 'name': name, 'salt': saltStr, score : 0}, function(err, result) {
            if (err) throw(err);
            if (result.ops.length > 0){
             res.json({message: '200 ok'});
            } else {
              res.json({message:'503 Server Error'});
            }
          });
        });
      });
    }
  });
 });

 // 점수읽기
 router.get('/myscore', function(req, res, next) {

 });

 // 점수추가
 router.post('/addscore', function(req, res, next) {
  var score = req.body.score;
  // var username = req.body.username;

  var db = req.app.get('database');

  if (db == undefined) {
    res.json({message: '503 Server Error'})
    return;
  }

  var userId = req.session.user_id;

  if (userId){
    var usersCollection = db.collection('users');
    usersCollection.update({_id:mongodb.ObjectID(userId)}, {$inc:{score:score}}, function(err, result) {
      if (err) throw (err);
      if (result) {
        res.json({message:'200 ok'});
      } else {
        res.json({message:'204 No Content'});
      }
    });
  }
  });
  // $set 그대로 점수적용 $inc:{score:-1}등으로 점수추가 감소 가능


  // 회원가입 정보 확인
  var userValidation = function(username, password) {
    if (username == '' || password == '') {
      return false;
    }
    if (username.length < 4 || username.length > 12){
      return false;
    }
    if (password.length < 4 || password.length > 12){
      return false;
    }
    return true;
  }


/*로그인*/
router.post('/signin', function(req, res, next){
  var username = req.body.username;
  var password = req.body.password;

  var db = req.app.get('database');

  if (db ==undefined){
    res.json({message:'503 Server Error'});
    return;
  }

  var usersCollection = db.collection('users');

  usersCollection.findOne({username: username}, function(err, result) {
    if (err) throw(err);

    if(result) {
      var saltStr = result.salt;
      crypto.pbkdf2(password, saltStr, 1031, 64, 'sha512', function(err, key) {
        var cryptoPassword = key.toString('base64');

        usersCollection.findOne({username: username, password: cryptoPassword},
          function(err, result) {
            if (err) throw (err);
            if (result) {
              // res.cookie('user_id', result._id.toString(), {
              //   maxAge:30000
              // });;
              req.session.user_id = result._id.toString();
              res.json({message:'200 ok'});
            } else {
              res.json({message:'204 NO Content'});
            }
          })
      });

    } else {
      res.json({message:'204 No Content'});
    }
  });
});

//로그아웃
router.get('logout', function(req, res, next) {
  req.session.destroy(function(err) { 
    res.json({message:'200 ok'});
  });
});

module.exports = router;
