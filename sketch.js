// --- 全域變數 ---
let sheet1;             // 1020004-removebg-preview.png (飛行)
let sheet2;             // 1020005-removebg-preview.png (單幀待機)
let sheet3;             // 1110006-removebg-preview.png (跳躍)
let sheet4;             // 11120009-removebg-preview.png (行走/待機輔助)

// 每幀尺寸：請注意，非整數的尺寸 (如 47.2, 47) 在像素級操作中可能導致問題。
let frameSize1 = { w: 55, h: 60 }; // sheet1 
let frameSize2 = { w: 50, h: 60 }; // sheet2 (主待機)
let frameSize3 = { w: 47.2, h: 60 }; // sheet3 (跳躍)
let frameSize4 = { w: 47, h: 60 }; // sheet4 (行走)

// 使用最大的高度來計算地面 Y 座標
let maxHeight = Math.max(frameSize1.h, frameSize2.h, frameSize3.h, frameSize4.h); 
let charSize = { w: frameSize1.w, h: frameSize1.h }; // 僅作參考，繪製使用 frameData.w/h

let imgScale = 3;       
let xPos;
let yPos;
let moveSpeed = 4;
let frameRateFactor = 5; 

// 物理變數
let gravity = 0.5;      
let jumpForce = -10;    
let jumpVelocity = 0;   
let groundY;            
let groundRatio = 0.25; // 地板佔畫布高度的比例 (1/4 = 0.25)
let isJumping = false;  
let upwardThrust = -0.3; 

// 角色狀態管理
let state = 'idle';     
let currentFrame = 0;
let facingDirection = 1; 
let prevState = '';     

// 飛行狀態追蹤
let isFlying = false; 

// 動畫幀序列
let idleFrames = []; 
let walkFrames = [];   
let jumpFrames = [];    
let flyFrames = [];     

// --- 新增雲朵相關變數 ---
let clouds = [];        // 儲存雲朵物件的陣列
let numClouds = 5;      // 雲朵數量
let cloudSpeed = 0.5;   // 雲朵移動速度

/**
 * 預載入圖片
 */
function preload() {
  sheet1 = loadImage('1020004-removebg-preview.png');
  sheet2 = loadImage('1020005-removebg-preview.png');
  sheet3 = loadImage('1110006-removebg-preview.png'); 
  sheet4 = loadImage('11120009-removebg-preview.png'); 
}

/**
 * 初始化畫布與動畫幀
 */
function setup() {
  createCanvas(windowWidth, windowHeight); 
  
  let groundHeight = height * groundRatio;
  let groundLineY = height - groundHeight;
  let halfHeight = maxHeight * imgScale / 2;
  groundY = groundLineY - halfHeight; 
  
  yPos = groundY; 
  xPos = width / 2;
  imageMode(CENTER);
  frameRate(60); 

  // --- 組合動畫幀序列 (保持不變) ---
  idleFrames.push({ img: sheet2, x: 0, y: 0, w: frameSize2.w, h: frameSize2.h }); 
  walkFrames.push({ img: sheet4, x: 0 * frameSize4.w, y: 0, w: frameSize4.w, h: frameSize4.h });
  walkFrames.push({ img: sheet4, x: 1 * frameSize4.w, y: 0, w: frameSize4.w, h: frameSize4.h });
  jumpFrames.push({ img: sheet3, x: 2 * frameSize3.w, y: 0, w: frameSize3.w, h: frameSize3.h }); 
  jumpFrames.push({ img: sheet3, x: 3 * frameSize3.w, y: 0, w: frameSize3.w, h: frameSize3.h }); 
  flyFrames.push({ img: sheet1, x: 0 * frameSize1.w, y: 0, w: frameSize1.w, h: frameSize1.h }); 
  flyFrames.push({ img: sheet1, x: 2 * frameSize1.w, y: 0, w: frameSize1.w, h: frameSize1.h }); 

  // --- 初始化雲朵 ---
  for (let i = 0; i < numClouds; i++) {
    clouds.push(createCloud());
  }
}

/**
 * 調整視窗大小時，同步調整畫布大小和地面位置
 */
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  
  let groundHeight = height * groundRatio;
  let groundLineY = height - groundHeight;
  let charHalfHeight = maxHeight * imgScale / 2;
  
  groundY = groundLineY - charHalfHeight;
  
  yPos = constrain(yPos, charHalfHeight, groundY);
  xPos = constrain(xPos, charHalfHeight, width - charHalfHeight);
  
  // 當視窗大小改變時，重新佈局雲朵以適應新尺寸 (可選，這裡只簡單重置)
  for (let i = 0; i < numClouds; i++) {
    clouds[i] = createCloud(random(width)); // 讓雲朵重新隨機分佈
  }
}


/**
 * 繪製迴圈
 */
function draw() {
  // *** 1. 繪製天空與地板 (1/4 地板, 3/4 天空) ***
  let groundHeight = height * groundRatio;
  let groundLineY = height - groundHeight;
  
  // 天空 (淺藍色)
  background(135, 206, 250); 

  // --- 繪製雲朵 ---
  for (let i = 0; i < clouds.length; i++) {
    drawCloud(clouds[i]);
    moveCloud(clouds[i]);
  }
  
  // 地板 (綠色)
  noStroke();
  fill(34, 139, 34); // Forest Green
  rect(0, groundLineY, width, groundHeight);
  
  // 2. 處理狀態和物理
  state = 'idle'; 
  isFlying = false; 

  handleKeyboardInput();
  applyPhysics();
  animateSprite();
  
  // 3. 繪製角色
  drawSprite();
  
  // 4. 顯示文字提示 (調整位置，避免被地板遮擋)
  fill(0);
  textSize(16);
  textAlign(CENTER);
  text(`狀態: ${state.toUpperCase()} | 空白鍵跳躍 | Shift鍵持續推進 (飛行)`, width / 2, groundLineY - 10);
}

// --- 核心函式定義 (保持不變) ---

function applyPhysics() {
  if (isJumping || isFlying || yPos < groundY) {
    jumpVelocity += gravity;
    
    if (isFlying) {
      jumpVelocity += upwardThrust; 
      jumpVelocity = constrain(jumpVelocity, jumpForce * 0.5, jumpVelocity);
    }

    yPos += jumpVelocity;
    
    if (yPos >= groundY) {
      yPos = groundY;          
      jumpVelocity = 0;        
      isJumping = false;       
      isFlying = false;        
    }
    
    yPos = constrain(yPos, maxHeight * imgScale / 2, yPos);
  }
}

function handleKeyboardInput() {
  let isMoving = false;
  
  if (keyIsDown(16)) {
    isFlying = true;
    state = 'fly';
  }

  let currentMoveSpeed = isFlying ? moveSpeed * 1.5 : (isJumping ? moveSpeed * 0.7 : moveSpeed); 
    
  if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) { 
    xPos -= currentMoveSpeed;
    facingDirection = -1; 
    isMoving = true;
  }
    
  if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) { 
    xPos += currentMoveSpeed;
    facingDirection = 1; 
    isMoving = true;
  }
  
  if (keyIsDown(32) && !isJumping && !isFlying && yPos >= groundY) {
    isJumping = true;         
    jumpVelocity = jumpForce; 
  }
  
  if (isFlying) {
    state = 'fly';
  } else if (isJumping || yPos < groundY) {
    state = 'jump';
  } else if (isMoving) {
    state = 'walk';
  }
  
  let scaledW = frameSize2.w * imgScale / 2; // 使用主待機寬度
  xPos = constrain(xPos, scaledW, width - scaledW);
}

function animateSprite() {
  // 狀態切換時重置幀計數
  if (state !== prevState) {
    currentFrame = 0;
    prevState = state;
  }

  // 飛行動畫
  if (state === 'fly') {
    currentFrame = (facingDirection === 1) ? 1 : 0;
    return;
  }

  // 跳躍動畫
  if (state === 'jump') {
    currentFrame = (jumpVelocity < 0) ? 0 : 1;
    return;
  }
  
  // 待機狀態：維持在第 0 幀
  if (state === 'idle') {
    currentFrame = 0;
    return;
  }

  // 行走狀態：循環動畫
  if (state === 'walk') {
      let framesArray = walkFrames;
      if (frameCount % frameRateFactor === 0) {
          currentFrame = (currentFrame + 1) % framesArray.length;
      }
  }
}

function drawSprite() {
  let frameData = null;

  if (state === 'idle') {
    frameData = idleFrames[currentFrame];
  } else if (state === 'walk') {
    frameData = walkFrames[currentFrame];
  } else if (state === 'jump') {
    frameData = jumpFrames[currentFrame];
  } else if (state === 'fly') {
    frameData = flyFrames[currentFrame]; 
  }

  if (!frameData || !frameData.img) return; 

  push();
    translate(xPos, yPos);

    if (state !== 'fly') {
      scale(facingDirection, 1);
    }

    image(
      frameData.img,
      0, 0,
      frameData.w * imgScale, 
      frameData.h * imgScale,
      frameData.x, frameData.y,
      frameData.w, frameData.h
    );
  pop();
}

function keyPressed() {
    if (keyCode === 32 || keyCode === 16 || keyCode === LEFT_ARROW || keyCode === RIGHT_ARROW) {
        return false;
    }
}

// --- 雲朵繪製與移動函式 (新增) ---

/**
 * 創建一個雲朵物件
 * @param {number} startX 初始X座標 (可選，預設為隨機超出畫面右側)
 * @returns {object} 雲朵物件 { x, y, w, h, speed }
 */
function createCloud(startX = random(width, width * 2)) {
  let yPosMax = height * (1 - groundRatio) - 50; // 確保雲朵在天空區域，且不會太低
  return {
    x: startX,
    y: random(50, yPosMax), // 雲朵 Y 座標範圍
    w: random(100, 250),    // 雲朵寬度
    h: random(30, 80),      // 雲朵高度
    speed: random(cloudSpeed * 0.5, cloudSpeed * 1.5) // 速度略有差異
  };
}

/**
 * 繪製單個雲朵
 * @param {object} cloud 雲朵物件
 */
function drawCloud(cloud) {
  noStroke();
  fill(255, 255, 255, 200); // 白色，略帶透明
  ellipse(cloud.x, cloud.y, cloud.w, cloud.h);
  ellipse(cloud.x - cloud.w * 0.3, cloud.y + cloud.h * 0.2, cloud.w * 0.6, cloud.h * 0.8);
  ellipse(cloud.x + cloud.w * 0.3, cloud.y + cloud.h * 0.2, cloud.w * 0.7, cloud.h * 0.7);
}

/**
 * 移動單個雲朵並在出界時重置
 * @param {object} cloud 雲朵物件
 */
function moveCloud(cloud) {
  cloud.x -= cloud.speed; // 從右向左移動

  // 如果雲朵完全移出畫面左側，則重置到畫面右側
  if (cloud.x < -cloud.w / 2) {
    cloud.x = width + cloud.w / 2 + random(width / 2); // 重置到右側，帶有一些隨機間隔
    let yPosMax = height * (1 - groundRatio) - 50;
    cloud.y = random(50, yPosMax); // 重置 Y 座標
    cloud.w = random(100, 250);     // 重新隨機大小
    cloud.h = random(30, 80);
    cloud.speed = random(cloudSpeed * 0.5, cloudSpeed * 1.5); // 重新隨機速度
  }
}