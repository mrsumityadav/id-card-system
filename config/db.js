const mongoose = require('mongoose')

mongoose.connect(process.env.MONGO_URL).then(function(){
    console.log('database connected successfully')
})

module.exports = mongoose.connection