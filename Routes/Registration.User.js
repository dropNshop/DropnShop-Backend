const express=require("express")
const router=express.Router()
const {register}=require('../Controllers/Registration/User/register.controller')
const {login}=require('../Controllers/Registration/User/login.controller')
const {getOwnProfile}=require('../Controllers/Registration/User/profile.controller')



const authMiddleware=require('../Middleware/authMiddleware')




router.post('/register',register);
router.post('/login',login);
router.get('/user',authMiddleware,getOwnProfile);


module.exports=router