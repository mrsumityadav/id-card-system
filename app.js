require('dotenv').config()
const express = require('express')
const app = express()

const logInRouter = require('./routes/login')
const signUpRouter = require('./routes/singup')
const adminRouter = require('./routes/admin')
const superAdminRouter = require('./routes/superadmin')

const cookieParser = require('cookie-parser')
const session = require('express-session');
const validateAdmin = require('./middleware/admin')
const validateSuperAdmin = require('./middleware/superAdmin')

app.use(express.static("public"))
app.set('view engine', 'ejs')
require('./config/db')
app.use(session({
  secret: "print-cart-secret",
  resave: false,
  saveUninitialized: true
})
);

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())


/* ===============================
   ROUTES
   =============================== */
app.use('/', logInRouter)
app.use('/signup', signUpRouter)

app.use('/admin', validateAdmin, adminRouter)
app.use('/superAdmin', validateSuperAdmin, superAdminRouter)

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running");
});