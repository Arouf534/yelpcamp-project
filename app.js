var express=require('express');
var app=express();
var methodOverride=require("method-override")

var mongoose=require('mongoose');

mongoose.connect("mongodb://localhost:27017/campgrounds",{ useUnifiedTopology: true });


var bodyparser=require('body-parser');
let sessions=require("client-sessions")
var bcrypt=require("bcryptjs")


app.use(sessions({
    cookieName:"session",
    secret:"abdulrouf",
    duration: 30*60*1000
}))

app.use(bodyparser.urlencoded({extended: true}))
app.set('view engine','ejs');
app.use(methodOverride("_method"))


var postSchema = new mongoose.Schema({

    name:String,
    content:String
})


var campgroundschema= new mongoose.Schema({
    name:String,
    image: String,
    user:{type: String},
    post: [postSchema]
})


var userSchema=new mongoose.Schema({
    name:{type:String,require:true},
    username:{type:String,require:true,unique:true},
    email:{type:String,require:true,unique:true},
    password:{type:String,require:true},
    image:{type:String},
    discr:{type:String},
    campground:[{type: mongoose.Schema.Types.ObjectId,ref:"Campground"}]
})





var Post=mongoose.model("Post",postSchema)


var Campground=mongoose.model("Campground",campgroundschema)


var User= mongoose.model("User",userSchema)




app.use(function(req,res,next){

    if(!(req.session.userId)){
        return next()
    }


    User.findOne({_id:req.session.userId}).populate("campground").exec(function(err,user){
        if(err){
            return next(err)
        }
        if(!user){
            return next()
        }
        console.log(user)
        req.user=user

        next()
        

    })
})






app.get('/',function(req,res){
    res.render('landing');
})


app.get("/dashboard",isLoggedIn,function(req,res){

    res.render("dashboard",{user:req.user})
})



app.get("/register",function(req,res){
    res.render("register",{error:undefined})
})

app.post("/register",function(req,res){
    // res.json(req.body)
    let hash=bcrypt.hashSync(req.body.password,14)
    req.body.password=hash
    User.create(req.body,function(err,user){
        
        if(err){
            let error="something is wrong"
            //console.log(err)
            if(err.code===11000){
                error="that email is already logged in"
            }
            return res.render("register",{error:error})
        }
        req.session.userId=user._id;
        res.redirect("/dashboard")
    })
})




app.get("/login",function(req,res){
    res.render("login",{error:undefined})
})

app.post("/login",function(req,res){
    if(req.user){
        res.render("login",{error:"alredy loged in with another id logout first"})
    }
    User.findOne({username:req.body.username},function(err,user){
        if(err || !user || !bcrypt.compareSync(req.body.password,user.password)){
            return res.render("login",{error:"wrong username/password"})
        }
        req.session.userId=user._id;
        res.redirect("/dashboard");
    })
})



app.get('/campgrounds',isLoggedIn,function(req,res){

    Campground.find({},function(err,camp){
        if(err){
            console.log(err);
        } else{
            res.render('campgrounds',{campgrounds:camp})
        }
    })

})

app.get('/dashboard/campgrounds/new',isLoggedIn,function(req,res){
    res.render('addcamp')
})

app.post('/dashboard/campgrounds',isLoggedIn,function(req,res){

    var name=req.body.name;
    var image=req.body.image;
    newcamp={name:name,image:image,user:req.user.username};
    Campground.create(newcamp,function(err,camp){
        if(err){
            console.log(err)
        } else{
            console.log(camp)
            req.user.campground.unshift(camp)
            req.user.save()
        }
    });
    res.redirect('/dashboard')

})


app.get("/dashboard/campgrounds/:id",isLoggedIn,function(req,res){
    Campground.findById(req.params.id,function(err,campground){
        if(err){
            console.log(err)
        } else{
            req.session.isOwner=true
            res.render("show",{campground:campground})
        }
    })

})

app.get("/campgrounds/:id",isLoggedIn,function(req,res){
    Campground.findById(req.params.id,function(err,campground){
        if(err){
            console.log(err)
        } else{
            req.session.isOwner=false
            res.render("show1",{campground:campground})
        }
    })

})


app.get("/campgrounds/:id/edit",isLoggedIn,function(req,res){
    if(!req.session.isOwner){
        return res.send("you are not authorise")
    }
    Campground.findById(req.params.id,function(err,campground){
        if(err){
            console.log(err)
        } else{
            res.render("edit",{campground:campground})
        }
    })


})

app.put("/campgrounds/:id",isLoggedIn,function(req,res){
    Campground.findByIdAndUpdate(req.params.id, { $set: req.body},function(err,campground){
        if(err){
            console.log(err)
        } else{
            console.log("campground updated")
            console.log(campground)
            res.redirect("/dashboard/campgrounds/"+req.params.id)
        }
    })

})


app.delete("/campgrounds/:id",isLoggedIn,function(req,res){
    Campground.findByIdAndRemove(req.params.id,function(err,campground){
        if(err){
            console.log(err)
        } else{
            console.log("campground deleted")
            console.log(campground)
            res.redirect("/campgrounds")
        }
    })

})

// app.get("/campgrounds/:id/comment",isLoggedIn,function(req,res){
//     res.render("comment",{id:req.params.id})
// })


app.post("/campgrounds/:id/comment",isLoggedIn,function(req,res){
    //res.send("comment post route")
    var id=req.params.id
    var comment={name:req.user.name,content:req.body.content}
    Post.create(comment,function(err,post){
        if(err){
            console.log(err)
        } else{
            console.log(post)
            Campground.findOne({_id:id},function(err,camp){
                if(err){
                    console.log(err)
                } else{
                    // console.log(camp)
                    camp.post.push(post)
                    camp.save(function(err,campground){
                        if(err){
                            console.log(err)
                        } else{
                            console.log(camp)
                            res.redirect(`/dashboard/campgrounds/${id}`)
                        }

                    })
                    
                }
            })
        }
    })  
})


app.get("/logout",function(req,res){
    if(req.session){
        req.session.reset()
    }

    res.redirect("/")
})

function isLoggedIn(req,res,next){
    if(!req.user){
        return res.redirect("/login")
    }
    return next()

}



app.listen(3000,function(){
    console.log('yelpcamp app has started');
    console.log('http://localhost:3000')
})


// Campground.findById(req.params.id,function(err,campground){
//     if(err){
//         console.log(err)
//     } else{
//         Post.create(req.body,function(err,post){
//             if(err){
//                 console.log(err)
//             } else {
//                 campground.post.push(post)
//                 campground.save(function(err,campground){
//                     if(err){
//                         console.log(err)
//                     } else{
//                         console.log(campground)
//                         res.redirect("/campgrounds/:id")
//                     }
//                 })
//             }
//         })
//     }
// })