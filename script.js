
var fileUploadEl = document.getElementById('file-upload-input')
var fileUploadBtn = document.getElementById('file-upload-btn')
var srcImg = document.getElementById('src-image')
var processingStage = document.getElementById('processing-stage')
var resultStage = document.getElementById('result-stage')
var welcomeStage = document.getElementById('welcome-stage')
let failed = false
let resultMsg = "Success"

let loadModel = async () => {
    return await tf.loadLayersModel('./assets/model.json');
}
const model = loadModel()

window.onload = function() {
	document.getElementById('loading-screen').classList.add("hide");
};

for (let el of document.getElementsByClassName('img-block')) {
    el.addEventListener("click", function(e) {
        welcomeStage.classList.add("hide")
        processingStage.classList.remove("hide")
        document.getElementById('loading-screen').classList.remove("hide");
        srcImg.src = e.target.src;
    })
}

document.getElementById('try-again').addEventListener("click", function(e) {
    resultStage.classList.add("hide")
    welcomeStage.classList.remove("hide")
})

fileUploadBtn.addEventListener("click", function(e) {
    fileUploadEl.click();
})

fileUploadEl.addEventListener("change", function (e) {
    welcomeStage.classList.add("hide")
    processingStage.classList.remove("hide")
    document.getElementById('loading-screen').classList.remove("hide");
    srcImg.src = URL.createObjectURL(e.target.files[0]);
    fileUploadEl.value = ""
});

srcImg.onload = async function () {
    failed = false;
    resultMsg = "Success";
	document.getElementById('loading-screen').classList.add("hide");
    var img = cv.imread(srcImg); // load the image from <img>
    var imgCnt = cv.imread(srcImg); // load the image from <img>
    var imgWarped = cv.imread(srcImg); // load the image from <img>
    var dst = new cv.Mat();
    let ksize = new cv.Size(5, 5);
    let dsize = new cv.Size(400, 400);
    let color = new cv.Scalar(0, 255, 255);
    cv.cvtColor(img, img, cv.COLOR_BGR2GRAY, 0)
    cv.GaussianBlur(img, img, ksize, 0, 0, cv.BORDER_DEFAULT) 
    cv.adaptiveThreshold(img, img, 255, 1, 1, 11, 2)
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    let biggest = new cv.MatVector();
    let maxArea = 0;
    cv.findContours(img, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
    for (let i = 0; i < contours.size(); ++i) {
        let tmp = new cv.Mat();
        let cnt = contours.get(i);
        let area = cv.contourArea(cnt, false);
        if (area > 50) {
            // You can try more different parameters
            let peri = cv.arcLength(cnt, true);
            cv.approxPolyDP(cnt, tmp, 0.02 * peri, true);
            if (area > maxArea && tmp.matSize[0] == 4){
                biggest.push_back(tmp)
                maxArea = area;
            }
        }
        cnt.delete();
    }
    cv.drawContours(imgCnt, biggest, biggest.size()-1, color, 3, cv.LINE_8, hierarchy, 0);
    if (biggest.size() >= 1) {
        biggest = biggest.get(biggest.size()-1);
        //Find the corners
        let corner1 = new cv.Point(biggest.data32S[0], biggest.data32S[1]);
        let corner2 = new cv.Point(biggest.data32S[2], biggest.data32S[3]);
        let corner3 = new cv.Point(biggest.data32S[4], biggest.data32S[5]);
        let corner4 = new cv.Point(biggest.data32S[6], biggest.data32S[7]);
        //Order the corners
        let cornerArray = [
            { corner: corner1 }, 
            { corner: corner2 }, 
            { corner: corner3 }, 
            { corner: corner4 }
        ];
        //Sort by Y position (to get top-down)
        cornerArray.sort((item1, item2) => (
            item1.corner.y < item2.corner.y) ? -1 : (item1.corner.y > item2.corner.y) ? 1 : 0
        ).slice(0, 5);
        //Determine left/right based on x position of top and bottom 2
        let tl = cornerArray[0].corner.x < cornerArray[1].corner.x ? cornerArray[0] : cornerArray[1];
        let tr = cornerArray[0].corner.x > cornerArray[1].corner.x ? cornerArray[0] : cornerArray[1];
        let bl = cornerArray[2].corner.x < cornerArray[3].corner.x ? cornerArray[2] : cornerArray[3];
        let br = cornerArray[2].corner.x > cornerArray[3].corner.x ? cornerArray[2] : cornerArray[3];
        
        // Transform!!
        let heightImg = 460
        let widthImg = 460
        dsize = new cv.Size(widthImg, heightImg);
        let finalDestCoords = cv.matFromArray(
            4, 1, cv.CV_32FC2, 
            [
                0, 0, widthImg - 1, 
                0, widthImg - 1, heightImg - 1, 
                0, heightImg - 1
            ]
        );
        let srcCoords = cv.matFromArray(
            4, 1, cv.CV_32FC2, 
            [
                tl.corner.x, tl.corner.y, tr.corner.x, 
                tr.corner.y, br.corner.x, br.corner.y, 
                bl.corner.x, bl.corner.y
            ]
        );
        let M = cv.getPerspectiveTransform(srcCoords, finalDestCoords)
        cv.warpPerspective(imgWarped, imgWarped, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
        cv.cvtColor(imgWarped, imgWarped, cv.COLOR_BGR2GRAY)
        cv.GaussianBlur(imgWarped, imgWarped, ksize, 0, 0, cv.BORDER_DEFAULT) 
        cv.adaptiveThreshold(imgWarped, imgWarped,255,cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV,5,2)
        // cv.erode(imgWarped, imgWarped, cv.Mat.ones(3, 3, cv.CV_8U));
        // cv.dilate(imgWarped, imgWarped, cv.Mat.ones(3, 3, cv.CV_8U));
        let rect = new cv.Rect(5, 5, 450, 450);
        imgWarped = imgWarped.roi(rect);
        query = []
        for (let row = 0; row < 9; row++) {
            r = []
            for (let col = 0; col < 9; col++) {
                let x = row * 50 + 4;
                let y = col * 50 + 4;
                let rect = new cv.Rect(y, x, 46, 46);
                dst = imgWarped.roi(rect);
                dsize = new cv.Size(28, 28);
                cv.resize(dst, dst, dsize);
                var incomingData = dst.data;
                // incomingData = removeWhitePad(incomingData, 4);
                dst = new cv.matFromArray(28, 28, cv.CV_8U, incomingData)
                // cv.imshow('the-canvas', dst); 
                var outputData = new Float32Array(incomingData.length); // create the Float32Array for output
                for (i = 0; i < incomingData.length; i++) {
                    outputData[i] = incomingData[i] / 255.0;
                }
                let p = await predict(outputData);
                r.push(p)
            }
            query.push(r)
        }
        biggest.delete();
        contours.delete();
        hierarchy.delete();
        img.delete(); 
        imgCnt.delete();
        imgWarped.delete();
        dst.delete();
        let before =  JSON.parse(JSON.stringify(query));
        console.log(before)
        if (solveSudoku(query)) {
            let after = query
            console.log(after)
            // cv.imshow('canvas', imgWarped); 
            drawCanvas(before, after)
        } else {
            failed = true;
            resultMsg = "Can't find any solution."
        }
    } else {
        resultMsg = "Can't find sudoku game."
        failed = true;
    }       
    await sleep(3000);
    if (failed) {
        // cv.imshow('canvas', imgWarped); 
        clearCanvas()
    }
    document.getElementById("result-msg").innerHTML = resultMsg
    processingStage.classList.add("hide")
    resultStage.classList.remove("hide")
}

var canvas = document.getElementById("canvas")
var ctx = canvas.getContext("2d")

canvas.width = 460
canvas.height = 460
function clearCanvas() {
    ctx.clearRect(0,0,460,460)
}

function drawCanvas(query, ans){
    ctx.clearRect(5,5,455,455)
    ctx.save()
    ctx.translate(5, 5)
    ctx.beginPath();
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, 450, 450);
    ctx.closePath()
    for(var i = 0; i <= 10; i++){
        var pos = i * 50
        ctx.beginPath()
        ctx.moveTo(pos, 0)
        ctx.lineTo(pos, 450)
        ctx.closePath()
        ctx.strokeStyle = (i % 3 != 0) ? "rgba(0, 0, 0, 0.2)" : "rgba(0, 0, 0, 0.6)" 
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(0, pos)
        ctx.lineTo(450, pos)
        ctx.closePath()
        ctx.strokeStyle = (i % 3 != 0) ? "rgba(0, 0, 0, 0.2)" : "rgba(0, 0, 0, 0.6)"
        ctx.stroke()
    }
    ctx.moveTo(0, 0)
    ctx.font = "20px Verdana";
    for (var r = 0; r < 9; r++) {
        for (var c = 0; c < 9; c++) {
            ctx.fillStyle = query[r][c] == 0 ? "#0d6efd" : "#000000";
            ctx.fillText(ans[r][c], c * 50 + 18, r * 50 + 32)
        }
    }
    ctx.restore()
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let removeWhitePad = (img, pad) => {
    for (let p = 0; p < pad; p++) {
        for (let i = 0; i < 28; i++) {
            img[28 * p + i] = 0;
            img[(28 * i) + p] = 0;
            img[28 * (27 - p) + i] = 0;
            img[(28 * i) + (27 - p)] = 0;
        }
    }
    return img;
}

let predict = async (img) => {
    let digit = 0;
    await model.then(res => {
        const tensor = tf.tensor(img, [1, 28, 28, 1])
        const prediction = res.predict(tensor);
        var res = tf.squeeze(prediction);
        argmax = tf.argMax(res).dataSync()[0];
        let prob = res.dataSync()[argmax];
        if (prob * 100 >= 80.0)
            digit = argmax
    }, function (err) {
        digit = 0;
    });
    return digit;
}

var solveSudoku = function(board) {
    return backtrack(board, 0, 0);
};

var backtrack = function(board, row, col) {
    let nRow = 9, nCol = 9;
    if (col == nCol) {
        return backtrack(board, row + 1, 0);
    }
    if (row == nRow) {
        return true;
    }
    /*已經有數字了直接跳下一格*/
    if (board[row][col] != 0) {
        return backtrack(board, row, col + 1);
    }
    
    for (let n = 1; n <= 9; n++) {
        if (!isValid(board, row, col, n)) 
            continue;
        board[row][col] = n
        if (backtrack(board, row, col + 1))
            return true;
        board[row][col] = 0;
    }
    return false;
};

var isValid = function(board, r, c, n) {
    for (let i =0; i < 9; i++) {
        if (board[r][i] == n) return false;
        if (board[i][c] == n) return false;
        if (board[parseInt(r/3)*3 + parseInt(i/3)][parseInt(c/3)*3 + i%3] == n) return false; 
    }
    return true;
};
