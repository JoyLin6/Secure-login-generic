var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var expressSession = require('express-session');
var bodyParser = require('body-parser');

var passwordless = require('passwordless');


var MongoStore = require('passwordless-mongostore-bcrypt-node');
var email   = require("emailjs");


var app = express();

// email setup is generic
var yourEmail = 'access@client-globalmeeting.com';
var yourPwd = 'password';
var yourSmtp = 'smtp.gmail.com';
var smtpServer  = email.server.connect({
   user:    yourEmail, 
   password: yourPwd, 
   host:    yourSmtp, 
   ssl:     true
});


// mongoose connection string is generic
var mongoose = require('mongoose');
mongoose.connect('mongodb://username:password@mongodb-url/collection-name');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback () {
    console.dir("connected to the database");
});
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE");
    next();
});


//schemas and models
var captionSchema = mongoose.Schema({

    user:String

})

var User = mongoose.model('users', captionSchema);

// Generic path to be sent via email
var host = 'application-url/';

var mongoURI = 'mongodb://mongodb-url/collection-name';

passwordless.init(new MongoStore(mongoURI));
passwordless.addDelivery(
    function(tokenToSend, uidToSend, recipient, callback) {
        // Send out token
        smtpServer.send({
           text:    'Hello!\nYou can now access link here: '
                + host + '?token=' + tokenToSend + '&uid=' + encodeURIComponent(uidToSend),
           from:    yourEmail, 
           to:      recipient,
           subject: 'The link just for You'
        },function(err, message) {
            if (err) {
                console.log(err);

            }
            callback(message);

        })
    },{ ttl: 1000*60*2 });

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
// Standard express setup
app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(expressSession({secret: '42'}));
app.use(express.static(path.join(__dirname, 'public')));

// Passwordless middleware
app.use(passwordless.sessionSupport());

// generic
app.use(passwordless.acceptToken({ successRedirect: '/redirectURL' }));

// CHECK /routes/index.js to better understand which routes are needed at a minimum
app.get('/', function(req, res) {
    res.render('index.html', { user: req.user });
});

app.get('/redirectURL',
    passwordless.restricted({ failureRedirect: '/' }),
    function(req, res) {
    res.render('redirectURL/index.html');
    });

app.get('/path2',
    passwordless.restricted({ failureRedirect: '/' }),
    function(req, res) {
        res.render('path2');
    });

app.get('/path3',
    passwordless.restricted({ failureRedirect: '/' }),
    function(req, res) {
        res.render('path3');
    });

app.get('/error',
    function(req, res) {
        res.render('error.html');
    });

app.post('/sendemail',
    function(req, res, next) {
       var user = req.user;
        next();
    },passwordless.requestToken(

        function(user, delivery, callback, req) {


            User.findOne({user: user}, function(err, user) {
                if(user)
                    callback(null, user.id)
                else
                    callback(null, null)
            })

        },{ failureRedirect: '/error'}),
    function(req, res) {
        // Success notification to user!
        res.render('sent')

    });


app.get('/sent',
    function(req, res) {
        res.render('sent.html');
    });

/* GET logout. */
app.get('/logout', passwordless.logout(
        {successFlash: 'Hope to see you soon!'} ),
    function(req, res) {
        res.redirect('/');
    });


app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// development error handler
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('sent', {
        message: err.message,
        error: err
    });
});


app.set('port', process.env.PORT || 3000);


var server = app.listen(app.get('port'), function() {
  console.log('Express server listening on port ' + server.address().port);
});
