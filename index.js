//This crude program is very rude. This may give Obrenic vibes.
//NOTES: Works on Firefox client and Microsoft Edge, but not the Chrome client for some reason.

const fs = require("fs");
const url = require("url");
const http = require("http");
const https = require("https");

//const credentials = require("./auth/credentials.json");

const port = 3000;
const server = http.createServer();

server.on("listening", listen_handler);
server.listen(port);
function listen_handler(){
	console.log(`Now Listening on Port ${port}`);
}

server.on("request", request_handler);
function request_handler(req, res){
    console.log(`New Request from ${req.socket.remoteAddress} for ${req.url}`);
    if(req.url === "/"){
        const form = fs.createReadStream("html/index.html");
		res.writeHead(200, {"Content-Type": "text/html"})
		form.pipe(res);
    }
    else if(req.url.startsWith("/pussypics")){
        const image_stream = fs.createReadStream(`.${req.url}`);
        image_stream.on('error', image_error_handler);
        function image_error_handler(err){
            res.writeHead(404, {"Content-Type":"text/plain"});
            res.write("404 Not Found", () => res.end());
        }
        image_stream.on('ready', deliver_image);
        function deliver_image(){
            res.writeHead(200, {"Content-Type":"image/jpeg"});
            image_stream.pipe(res);
        }
    }
    else if(req.url.startsWith("/looking4pussypics")){
        const {cat_breed} = url.parse(req.url, true).query;

        console.log(`${cat_breed}`); //testing
        check_breed_existence(cat_breed, res);
    }
    else{
        res.writeHead(404, {"Content-Type": "text/html"});
        res.end(`<h1>404 Not Found</h1>`);
    }
}

function check_breed_existence(cat_breed, res){
    const catbreeds_endpoint = `https://api.thecatapi.com/v1/breeds`;
    const catbreeds_request = https.get(catbreeds_endpoint,{method:"GET"});

    catbreeds_request.once("error", err => {throw err});
    catbreeds_request.once("response", cat_breeds_stream => process_stream(cat_breeds_stream, parse_breeds));
    catbreeds_request.end();

    function process_stream (cats_breeds_stream){
		let cat_breeds = "";
		cats_breeds_stream.on("data", chunk => cat_breeds += chunk);
		cats_breeds_stream.on("end", () => parse_breeds(cat_breeds, cat_breed, res, get_catpics));
	}
}

function parse_breeds(cat_breeds, cat_breed, res, get_catpics){
    let cat_breeds_object = JSON.parse(cat_breeds);
    let exists = false;
    let all_breed_names = "";
    for(i = 0; i < cat_breeds_object.length; i++){
        if(i == cat_breeds_object.length - 1){
            all_breed_names += "and " + String(cat_breeds_object[i].name + ".");
            break;
        }
        all_breed_names += String(cat_breeds_object[i].name) + ", ";
        if(String(cat_breeds_object[i].name).toUpperCase() === cat_breed.toUpperCase()){
            exists = true;
            cat_breed = cat_breeds_object[i].id;
            break;
        }
    }
    if (exists){
        get_catpics(cat_breed, res, parse_breed_data);
    }
    else{
        res.writeHead(404, {"Content-Type": "text/html"});
        res.end(`<h1>You need to learn your cats or fix your grammar. Or maybe your cat is not in the system. Who knows.</h1>
                <p> Here is the Full List:</p>
                <p>${all_breed_names}</p>
                <form>
                    <input type="button" value="Return" onclick="history.back()">
                </form>`);
    }
}

function get_catpics(cat_breed, res, parse_breed_data){

    const catpics_endpoint = `https://api.thecatapi.com/v1/images/search?&breed_ids=${cat_breed}`;
    const catpics_request = https.request(catpics_endpoint,{method:"GET", headers:credentials});

    catpics_request.once("error", err => {throw err});
    catpics_request.once("response", cats_stream => process_stream(cats_stream, parse_breed_data));
    catpics_request.end();

    function process_stream (cats_stream){
		let cat_breed_data = "";
		cats_stream.on("data", chunk => cat_breed_data += chunk);
		cats_stream.on("end", () => parse_breed_data(cat_breed_data, res, display_cat_pic));
	}
}

function parse_breed_data(cat_breed_data, res, display_cat_pic){
    const downloaded_images = {images:[]};
    let cat_object = JSON.parse(cat_breed_data);
    
    let cat_breed_name = String(cat_object[0].breeds[0].name);
    
    display_cat_pic(cat_object, downloaded_images, cat_breed_name, res);
}

function display_cat_pic(cat_object, downloaded_images, cat_breed_name, res){
    //for testing caching
    //let cat_breed_pic_url = "https://cdn2.thecatapi.com/images/4-5SzDNIL.jpg";
    let cat_breed_pic_url = String(cat_object[0].url);
        console.log(cat_breed_pic_url); //testing
    let tokenized_url = cat_breed_pic_url.split("/");
    //for testing caching
    //let filename = "4-5SzDNIL.jpg";
    let filename = tokenized_url[tokenized_url.length - 1];
        console.log(filename); //testing
    const img_path = `pussypics/${filename}`;
        console.log(img_path);
    fs.access(img_path, fs.constants.F_OK, (err) => {
        if(err){
            const image_request = https.get(cat_breed_pic_url);
            image_request.on("response", function receive_image_data(image_stream){
                const save_image = fs.createWriteStream(img_path, {encoding:null});
                image_stream.pipe(save_image);
                save_image.on("finish", function(){
                    console.log("Download Image", img_path);
                    transfer_function(downloaded_images, img_path, cat_breed_name, res);
                })
            })
        }
        else{
            console.log("Image is Cached", img_path);
            transfer_function(downloaded_images, img_path, cat_breed_name, res);
        }
    })
    function transfer_function(downloaded_images, img_path, cat_breed_name, res){
        downloaded_images.images.push(img_path);
        generate_webpage(downloaded_images.images, cat_breed_name, res, get_insult);
    }
}

function generate_webpage(image_urls, cat_breed_name, res, get_insult){
    console.log(image_urls); //testing
    let image_component = image_urls.map(image_url => `<img src="./${image_url}" />`);
    
    get_insult(cat_breed_name, image_component, res);
}

function get_insult(cat_breed_name, image_component, res){
    const insult_endpoint = `https://evilinsult.com/generate_insult.php?lang=en&type=json`;
    const insult_request = https.request(insult_endpoint, {method:"GET"});

    insult_request.once("error", err => {throw err});
    insult_request.once("response", insult_stream => process_stream(insult_stream, display_insult_data));
    insult_request.end();

    function process_stream (insult_stream){
		let insult_data = "";
		insult_stream.on("data", chunk => insult_data += chunk);
		insult_stream.on("end", () => display_insult_data(cat_breed_name, image_component, insult_data, res));
    }
}

function display_insult_data(cat_breed_name, image_component, insult_data, res){
    let insult_object = JSON.parse(insult_data);

    let insult_string = String(insult_object.insult);

    res.writeHead(200, "text/html");
    res.end(`<h3>${cat_breed_name} Cat. Now fuck off. ${insult_string}</h3>
            <p> ${image_component}</p>`);
}