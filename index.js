require("dotenv").config();
const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
mongoose.set("strictQuery", true);
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: "keyboard cat",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());

// mongoose.connect("mongodb://127.0.0.1:27017/MyDB", { useNewUrlParser: true });

mongoose.connect(
  "mongodb+srv://nknikhilkr73:lTimO8ISQVSlN4Jq@cluster0.zoeey6c.mongodb.net/MyDB",
  { useNewUrlParser: true, useUnifiedTopology: true }
);
const userSchema = new mongoose.Schema({
  googleId: String,
  email: String,
  password: String,
  secret: [{ secretText: String, date: Date }],
  list: Array,
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, user.id);
  });
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    console.error(err);
    done(err, null);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      // callbackURL: "http://localhost:4000/auth/google/todolist",
      callbackURL: "https://chatanonymously.onrender.com/auth/google/todolist",
    },
    function (accessToken, refreshToken, profile, cb) {
      const username = profile.displayName + profile.id;

      User.findOrCreate(
        { googleId: profile.id, username: username },
        function (err, user) {
          return cb(err, user);
        }
      );
    }
  )
);

app.get("/", function (req, res) {
  res.render("home");
});
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

app.get(
  "/auth/google/todolist",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect home.
    res.redirect("/todolist");
  }
);

app.get("/login", function (req, res) {
  res.render("login");
});



app.get("/todolist", function (req, res) {
  User.findById(req.user.id, function (err, user) {
    if (err) {
      console.log(err);
    } else {
      if (user) {
        res.render("todolist", { List: user.list });
      }
    }
  });
});

app.get("/register", function (req, res) {
  res.render("register");
});
app.get("/logout", function (req, res) {
  req.logout(() => {});
  res.redirect("/");
});


app.post("/submitTo", function (req, res) {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }
  const listItem = req.body.listItem;
  if (listItem === "") {
    res.send(
      "<script>alert('Can\\'t add a blank text');window.location.href='/todolist'</script>"
    );
  } else {
    User.findById(req.user.id, function (err, user) {
      if (err) {
        console.log(err);
      } else {
        if (user) {
          user.list.push(listItem);
          user.save(function () {
            res.redirect("/todolist");
          });
        }
      }
    });
  }
});

app.post("/delete", function (req, res) {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  } else {
    const checkedItem = req.body.checkbox;

    User.findById(req.user.id, function (err, user) {
      if (err) {
        console.log(err);
      } else {
        if (user) {
          const index = user.list.indexOf(checkedItem);
          if (index !== -1) {
            user.list.splice(index, 1);
            user.save(function () {
              res.redirect("/todolist");
            });
          } else {
            console.log(err);
          }
        }
      }
    });
  }
});

app.post("/register", function (req, res) {
  User.register(
    { username: req.body.username },
    req.body.password,
    function (err, user) {
      if (req.body.username === "") {
        res.send(
          "<script>alert('Please Enter a Username'); window.location.href='/register';</script>"
        );
      } else if (req.body.password === "") {
        res.send(
          "<script>alert('Please enter the password'); window.location.href='/register';</script>"
        );
      } else if (err) {
        res.send(
          "<script>alert('Username already exists'); window.location.href='/register';</script>"
        );
      } else {
        passport.authenticate("local")(req, res, function () {
          res.redirect("/todolist");
        });
      }
    }
  );
});

app.post("/login", function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  User.findOne({ username: req.body.username }, function (err, foundUser) {
    if (req.body.username === "") {
      res.send(
        "<script>alert('Please Enter a Username'); window.location.href='/login';</script>"
      );
    } else if (req.body.password === "") {
      res.send(
        "<script>alert('Please enter the password'); window.location.href='/login';</script>"
      );
    } else if (err) {
      console.log(err);
      res.send(
        "<script>alert('Server Error'); window.location.href='/login';</script>"
      );
      console.log(err);
    } else {
      if (foundUser) {
        req.login(user, function (err) {
          if (err) {
            res.send(
              "<script>alert('Wrong username or password'); window.location.href='/login';</script>"
            );
          } else {
            passport.authenticate("local")(req, res, function () {
              res.redirect("/todolist");
            });
          }
        });
      } else {
        res.send(
          "<script>alert('This username is not registered'); window.location.href='/login';</script>"
        );
      }
    }
  });
});

app.listen(process.env.PORT || 4000, function () {
  console.log("Server started on port 4000");
});
