
function another_promise(i, cb) {
    new Promise((resolve, reject)=>{ 
        setTimeout(()=>{ resolve(i); }, 1000); 
    }).then(res=>{cb(null, res);}).catch(ex=>{cb(ex, null);});
}

function handle(pending, counter, cbb)
{
    console.log("handle(): pending =", pending);
    let err_list = [];
    another_promise(counter+1, function(err, res){
        console.log("another_promise():", res);
        if (!--pending) {
            console.log("pending is over!!");
            cbb(err_list);
            return;
        }
        else{
            console.log("calling handle()...");
            handle(pending, counter+1);
        } 
    }); 
}

handle(3,0, function(res){
    console.log("the end!", res);
})
//.then(res=>{console.log("ress:",res)}).catch(ex=>{console.log("exx:",ex)});