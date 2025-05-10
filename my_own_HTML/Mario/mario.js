// 超级马里奥网页版多关卡版
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 碰撞检测函数
function rectsCollide(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// 游戏参数
const GRAVITY = 0.6;
const MOVE_SPEED = 3;
const JUMP_POWER = 12;
const MAX_JUMP = 2; // 二段跳
const worldWidth = 2000; // 地图宽度
const TOTAL_LEVELS = 15; // 总关卡数改为15关
const STOMP_MARGIN = 30; // 踩死判定的容差范围（像素）
const INVINCIBLE_FRAMES = 45; // 无敌帧持续时间（约0.75秒）
const MAX_ENEMIES = Math.pow(2, 15); // 最大敌人数量为2^15（32768）

// 音效
const jumpSound = new Audio('jump.wav');
const coinSound = new Audio('coin.wav');
const gameoverSound = new Audio('gameover.wav');
const killSound = new Audio('kill.wav');
const flagSound = new Audio('flag.wav');  // 添加升旗音效

let level = 1;
let maxUnlockedLevel = 1;  // 添加最大解锁关卡记录
let score = 0;
let gameOver = false;
let levelPassed = false;
let levelSelectionMode = false;  // 添加选关模式标志

// 平台
let platforms = [];
const basePlatforms = [
    { x: 0, y: 350, width: worldWidth, height: 50 }, // 地面
    { x: 200, y: 200, width: 100, height: 15 },
    { x: 400, y: 180, width: 100, height: 15 },
    { x: 600, y: 220, width: 80, height: 15 },
    { x: 900, y: 190, width: 120, height: 15 },
    { x: 1200, y: 170, width: 100, height: 15 },
    { x: 1500, y: 160, width: 120, height: 15 },
    { x: 1800, y: 200, width: 100, height: 15 },
];

// 砖块、金币、敌人、旗子
let bricks = [];
let coins = [];
let enemies = [];
let flag = null;
let flagRaising = false;
let flagY = 0;
let flagParticles = [];  // 添加旗子粒子效果

// 马里奥对象
const mario = {
    x: 50,
    y: 300,
    width: 32,
    height: 32,
    vx: 0,
    vy: 0,
    onGround: false,
    color: '#ff0000',
    jumpCount: 0,
    invincibleTime: 0, // 无敌时间计数器
};

// 连续砖块生成概率
const brickGroupProbs = [0.3, 0.3, 0.3, 0.09, 0.01];
function randomBrickGroupLen() {
    const r = Math.random();
    let sum = 0;
    for (let i = 0; i < brickGroupProbs.length; i++) {
        sum += brickGroupProbs[i];
        if (r < sum) return i + 1;
    }
    return 1;
}

function randomNonOverlappingPositions(count, width, height, avoidAreas, minY, maxY) {
    const positions = [];
    let tries = 0;
    while (positions.length < count && tries < 1000) {
        const x = Math.floor(Math.random() * (worldWidth - width - 50)) + 50;
        const y = Math.floor(Math.random() * (maxY - minY)) + minY;
        const rect = { x, y, width, height };
        
        // 不与已有物体重叠
        let overlap = false;
        for (const area of avoidAreas) {
            if (
                x < area.x + area.width &&
                x + width > area.x &&
                y < area.y + area.height &&
                y + height > area.y
            ) {
                overlap = true;
                break;
            }
        }
        for (const p of positions) {
            if (
                x < p.x + p.width &&
                x + width > p.x &&
                y < p.y + p.height &&
                y + height > p.y
            ) {
                overlap = true;
                break;
            }
        }
        if (!overlap) positions.push(rect);
        tries++;
    }
    return positions;
}

function randomInt(a, b) {
    return Math.floor(Math.random() * (b - a + 1)) + a;
}

function initLevel() {
    levelPassed = false;
    flagRaising = false;
    
    // 定义高度范围（从地面开始到最高点）
    const MAX_HEIGHT = 200;
    
    // 难度递增：平台数量减少，砖块金币怪物数量增加
    const platCount = Math.max(5, basePlatforms.length - Math.floor(level / 2));
    platforms = [basePlatforms[0]]; // 地面
    
    // 生成其他平台，随机高度
    const availablePlatforms = basePlatforms.slice(1).map(plat => ({
        ...plat,
        y: Math.floor(Math.random() * MAX_HEIGHT) + 50  // 从50像素高度开始随机生成
    }));
    
    // 随机选择并添加平台
    for (let i = 1; i < platCount; i++) {
        platforms.push(availablePlatforms[i - 1]);
    }

    // 砖块（分为可打碎和不可打碎，连续生成）
    const brickCount = 6 + Math.min(level, 6);
    const unbreakableCount = Math.floor(brickCount / 2);
    bricks = [];
    let avoidAreas = [...platforms];
    let totalBricks = 0;
    let maxTries = 1000;
    while (totalBricks < brickCount && maxTries-- > 0) {
        const groupLen = Math.min(randomBrickGroupLen(), brickCount - totalBricks, 5);
        const x = Math.floor(Math.random() * (worldWidth - 40 * groupLen - 50)) + 50;
        // 修改砖块的Y坐标生成范围
        const y = Math.floor(Math.random() * MAX_HEIGHT) + 50;  // 从50像素高度开始随机生成
        
        // 检查是否与已有物体重叠
        let overlap = false;
        for (const area of avoidAreas) {
            if (
                x < area.x + area.width &&
                x + 40 * groupLen > area.x &&
                y < area.y + area.height &&
                y + 20 > area.y
            ) {
                overlap = true;
                break;
            }
        }
        if (!overlap) {
            for (let i = 0; i < groupLen; i++) {
                bricks.push({
                    x: x + i * 40,
                    y: y,
                    width: 40,
                    height: 20,
                    hit: false,
                    unbreakable: totalBricks < unbreakableCount
                });
                avoidAreas.push({ x: x + i * 40, y, width: 40, height: 20 });
                totalBricks++;
                if (totalBricks >= brickCount) break;
            }
        }
    }

    // 金币
    const coinCount = 8 + Math.min(level * 2, 12);
    // 修改 randomNonOverlappingPositions 函数调用，移除最低高度限制
    const coinAreas = randomNonOverlappingPositions(coinCount, 16, 16, platforms.concat(bricks), 50, MAX_HEIGHT);
    coins = [];
    for (const c of coinAreas) {
        coins.push({ x: c.x, y: c.y, width: 16, height: 16, collected: false });
    }
    // 敌人数量指数增长：基础数量2，每关翻倍，最多2^15个
    const baseEnemyCount = 2;
    const enemyCount = Math.min(Math.floor(baseEnemyCount * Math.pow(2, level - 1)), MAX_ENEMIES);
    console.log('Level:', level, 'Enemies:', enemyCount);
    enemies = [];
    const allSurfaces = [platforms[0], ...bricks.filter(b => b.unbreakable)];
    for (let i = 0; i < enemyCount; i++) {
        let surf, ex;
        let tryCount = 0;
        do {
            surf = allSurfaces[randomInt(0, allSurfaces.length - 1)];
            ex = randomInt(surf.x, surf.x + surf.width - 28);
            tryCount++;
        } while (ex < 200 && tryCount < 20); // 避开出生点
        const ey = surf.y - 32;
        const dir = Math.random() < 0.5 ? 1 : -1;
        const vx = 1.2 + Math.random() * 0.8;
        enemies.push({ x: ex, y: ey, width: 28, height: 32, vx, dir, onGround: true });
    }
    // 旗子
    flag = {
        x: worldWidth - 40,
        y: platforms[0].y - 240,  // 高度改为240（原来的2倍）
        width: 20,
        height: 240  // 高度改为240（原来的2倍）
    };
    flagY = flag.y + flag.height * 0.75;  // 旗子初始位置在从上往下3/4处
}

// 键盘输入
const keys = {};
document.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'KeyL' && !gameOver) {  // 按L键进入选关模式
        enterLevelSelection();
    }
});
document.addEventListener('keyup', e => {
    keys[e.code] = false;
});

// 支持PNG透明贴图，优先加载png，没有则回退jpg
function loadImageWithFallback(base) {
    const img = new Image();
    img.src = base + '.png';
    img.onerror = function() {
        img.onerror = null;
        img.src = base + '.jpg';
    };
    return img;
}

const marioImg = loadImageWithFallback('mario');
const enemyImg = loadImageWithFallback('enemy');

// 等待图片加载完成后开始游戏
function startGame() {
    resetGame();
    requestAnimationFrame(gameLoop);
}

// 确保图片加载完成后再开始游戏
let imagesLoaded = 0;
const totalImages = 2;

function onImageLoad() {
    imagesLoaded++;
    if (imagesLoaded === totalImages) {
        startGame();
    }
}

marioImg.onload = onImageLoad;
enemyImg.onload = onImageLoad;

let inputLocked = false;
let lockEndTime = 0;

function startLockCountdown() {
    inputLocked = true;
    lockEndTime = Date.now() + 3000;
}

let nextLevelTimer = null;  // 添加一个计时器变量

function nextLevel() {
    if (nextLevelTimer) {
        clearTimeout(nextLevelTimer);
    }
    nextLevelTimer = null;
    level++;
    
    // 检查是否通关全部15关
    if (level > TOTAL_LEVELS) {
        // 游戏通关，显示通关界面
        gameOver = true;
        gamePaused = true;
        levelPassed = true;
        return;
    }
    
    if (level > maxUnlockedLevel) {
        maxUnlockedLevel = level;  // 更新最大解锁关卡
    }
    mario.x = 50;
    mario.y = 300;
    mario.vx = 0;
    mario.vy = 0;
    mario.jumpCount = 0;
    gameOver = false;
    levelPassed = false;
    flagRaising = false;
    gamePaused = false;
    levelSelectionMode = false;  // 退出选关模式
    flagParticles = [];  // 清空粒子效果
    startLockCountdown();
    initLevel();
}

function triggerNextLevel() {
    if (levelPassed) return;
    levelPassed = true;
    gamePaused = true;  // 立即暂停游戏
    
    // 延迟1.2秒后切换关卡
    if (nextLevelTimer) {
        clearTimeout(nextLevelTimer);
    }
    nextLevelTimer = setTimeout(() => {
        nextLevel();
    }, 1200);
}

function resetGame() {
    mario.x = 50;
    mario.y = 300;
    mario.vx = 0;
    mario.vy = 0;
    mario.jumpCount = 0;
    score = 0;
    gameOver = false;
    level = 1;
    levelPassed = false;
    gamePaused = false;
    levelSelectionMode = false;
    flagParticles = [];
    selectedOption = 0;  // 重置选项选择
    startLockCountdown();
    initLevel();
}

let jumpPressed = false;

// 添加游戏状态变量
let gamePaused = false;

// 在文件开头添加特效数组
let specialEffects = [];

// 添加选关功能
function enterLevelSelection() {
    levelSelectionMode = true;
    gamePaused = true;
}

// 手柄支持
let gamepadConnected = false;
let lastGamepadButtons = [];
let selectedOption = 0; // 游戏结束界面的选项选择

// 手柄连接事件
window.addEventListener("gamepadconnected", function(e) {
    console.log("手柄已连接：", e.gamepad);
    gamepadConnected = true;
});

window.addEventListener("gamepaddisconnected", function(e) {
    console.log("手柄已断开：", e.gamepad);
    gamepadConnected = false;
});

// 更新手柄输入
function updateGamepadInput() {
    if (!gamepadConnected) return;
    
    const gamepads = navigator.getGamepads();
    if (!gamepads) return;

    const gamepad = gamepads[0]; // 使用第一个手柄
    if (!gamepad) return;

    // 方向键或左摇杆
    if (gamepad.axes[0] < -0.5 || gamepad.buttons[14].pressed) { // 左
        keys['ArrowLeft'] = true;
        keys['ArrowRight'] = false;
    } else if (gamepad.axes[0] > 0.5 || gamepad.buttons[15].pressed) { // 右
        keys['ArrowLeft'] = false;
        keys['ArrowRight'] = true;
    } else {
        keys['ArrowLeft'] = false;
        keys['ArrowRight'] = false;
    }

    // 上下方向键或左摇杆上下 - 用于菜单选择
    if (gamepad.axes[1] < -0.5 || gamepad.buttons[12].pressed) { // 上
        keys['ArrowUp'] = true;
        keys['ArrowDown'] = false;
    } else if (gamepad.axes[1] > 0.5 || gamepad.buttons[13].pressed) { // 下
        keys['ArrowUp'] = false;
        keys['ArrowDown'] = true;
    } else {
        keys['ArrowUp'] = false;
        keys['ArrowDown'] = false;
    }

    // A键(0)、B键(1)、X键(2)、Y键(3) 任意一个按下都跳跃或确认选择
    const actionPressed = gamepad.buttons[0].pressed || 
                        gamepad.buttons[1].pressed || 
                        gamepad.buttons[2].pressed || 
                        gamepad.buttons[3].pressed;
    keys['Space'] = actionPressed;

    // 菜单键(≡)(8)或分享键(⧉)(9) - 进入选关模式
    if ((gamepad.buttons[8].pressed || gamepad.buttons[9].pressed) && 
        !lastGamepadButtons[8]?.pressed && 
        !lastGamepadButtons[9]?.pressed && 
        !gameOver) {
        enterLevelSelection();
    }

    // 游戏结束界面的手柄控制
    if (gameOver) {
        // 上下键选择选项
        if ((gamepad.axes[1] < -0.5 || gamepad.buttons[12].pressed) && 
            !lastGamepadButtons[12]?.pressed) {
            selectedOption = 0;
        } else if ((gamepad.axes[1] > 0.5 || gamepad.buttons[13].pressed) && 
                   !lastGamepadButtons[13]?.pressed) {
            selectedOption = 1;
        }
        
        // A键确认选择
        if (gamepad.buttons[0].pressed && !lastGamepadButtons[0]?.pressed) {
            if (selectedOption === 0) {
                resetGame();
            } else {
                window.close();
                alert('请直接关闭浏览器窗口来退出游戏');
            }
        }
    }

    // 更新按钮状态
    lastGamepadButtons = gamepad.buttons.map(b => ({pressed: b.pressed}));
}

// 添加移动设备支持
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const virtualButtons = {
    left: { x: 20, y: canvas.height - 100, width: 60, height: 60, pressed: false },
    right: { x: 100, y: canvas.height - 100, width: 60, height: 60, pressed: false },
    jump: { x: canvas.width - 80, y: canvas.height - 100, width: 60, height: 60, pressed: false },
    menu: { x: canvas.width - 50, y: 20, width: 40, height: 40, pressed: false }
};

// 触摸事件处理
function handleTouchStart(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touches = e.touches;
    
    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        // 检查每个虚拟按钮
        for (const [key, btn] of Object.entries(virtualButtons)) {
            if (x >= btn.x && x <= btn.x + btn.width &&
                y >= btn.y && y <= btn.y + btn.height) {
                btn.pressed = true;
                if (key === 'menu' && !gameOver) {
                    enterLevelSelection();
                }
            }
        }
    }
}

function handleTouchMove(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touches = e.touches;
    
    // 重置所有按钮状态
    for (const btn of Object.values(virtualButtons)) {
        btn.pressed = false;
    }
    
    // 检查每个触摸点
    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        for (const btn of Object.values(virtualButtons)) {
            if (x >= btn.x && x <= btn.x + btn.width &&
                y >= btn.y && y <= btn.y + btn.height) {
                btn.pressed = true;
            }
        }
    }
}

function handleTouchEnd(e) {
    e.preventDefault();
    // 重置所有按钮状态
    for (const btn of Object.values(virtualButtons)) {
        btn.pressed = false;
    }
}

// 如果是移动设备，添加触摸事件监听器
if (isMobile) {
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
}

function update() {
    // 更新手柄输入
    updateGamepadInput();

    // 调试输出
    console.log('inputLocked:', inputLocked, 'lockEndTime:', lockEndTime, 'now:', Date.now(), 'gameOver:', gameOver, 'levelPassed:', levelPassed);
    
    // 更新旗子动画和粒子效果，即使在游戏暂停时也继续
    if (flagRaising) {
        // 旗子升起
        if (flagY > flag.y) {
            flagY -= 8;  // 升旗速度
            // 添加上升过程中的粒子
            if (Math.random() < 0.5) {  // 增加粒子生成概率
                flagParticles.push({
                    x: flag.x + flag.width/2,
                    y: flagY,
                    vx: (Math.random() - 0.5) * 2,
                    vy: -Math.random() * 2,
                    life: 30 + Math.random() * 20,
                    color: Math.random() < 0.5 ? '#fff' : '#ff0'
                });
            }
        }
        if (flagY < flag.y) {
            flagY = flag.y;
        }
    }

    // 更新粒子效果
    for (let i = flagParticles.length - 1; i >= 0; i--) {
        const particle = flagParticles[i];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.1;  // 重力
        particle.life--;
        if (particle.life <= 0) {
            flagParticles.splice(i, 1);
        }
    }

    // 如果游戏暂停，不更新其他游戏逻辑
    if (gameOver || gamePaused) return;

    // 输入锁定（基于时间戳）
    if (inputLocked && Date.now() >= lockEndTime) {
        inputLocked = false;
    }

    // 如果输入被锁定，暂停所有游戏逻辑
    if (inputLocked) {
        return;
    }

    // 修改输入检测部分
    if (keys['ArrowLeft'] || keys['KeyA'] || virtualButtons.left.pressed) {
        mario.vx = -MOVE_SPEED;
    } else if (keys['ArrowRight'] || keys['KeyD'] || virtualButtons.right.pressed) {
        mario.vx = MOVE_SPEED;
    } else {
        mario.vx = 0;
    }

    // 跳跃（支持二段跳）
    if ((keys['ArrowUp'] || keys['Space'] || keys['KeyW'] || virtualButtons.jump.pressed)) {
        if (!jumpPressed && mario.jumpCount < MAX_JUMP) {
            mario.vy = -JUMP_POWER;
            mario.onGround = false;
            mario.jumpCount++;
            jumpSound.currentTime = 0;
            jumpSound.play();
        }
        jumpPressed = true;
    } else {
        jumpPressed = false;
    }

    // 应用重力
    mario.vy += GRAVITY;

    // 水平移动和碰撞
    mario.x += mario.vx;
    for (let plat of [...platforms, ...bricks]) {
        if (rectsCollide(mario, plat)) {
            if (mario.vx > 0) {
                mario.x = plat.x - mario.width;
            } else if (mario.vx < 0) {
                mario.x = plat.x + plat.width;
            }
        }
    }

    // 垂直移动和碰撞
    mario.y += mario.vy;
    let wasOnGround = mario.onGround;
    mario.onGround = false;
    for (let plat of platforms) {
        if (rectsCollide(mario, plat)) {
            if (mario.vy > 0) {
                // 脚踩到平台
                mario.y = plat.y - mario.height;
                mario.vy = 0;
                mario.onGround = true;
            } else if (mario.vy < 0) {
                // 头顶撞到平台
                mario.y = plat.y + plat.height;
                mario.vy = 0;
            }
        }
    }
    for (let brick of bricks) {
        if (rectsCollide(mario, brick)) {
            if (mario.vy > 0) {
                // 脚踩到砖块
                mario.y = brick.y - mario.height;
                mario.vy = 0;
                mario.onGround = true;
            } else if (mario.vy < 0) {
                // 头顶撞到砖块
                mario.y = brick.y + brick.height;
                mario.vy = 0;
                if (!brick.hit && !brick.unbreakable) {
                    brick.hit = true;
                    // 0.33概率爆出3金币
                    if (Math.random() < 0.33) {
                        for (let i = 0; i < 3; i++) {
                            coins.push({
                                x: brick.x + 12 * i,
                                y: brick.y - 18,
                                width: 16,
                                height: 16,
                                collected: false,
                                vy: -7 - Math.random() * 2,
                                vx: (Math.random() - 0.5) * 3,
                                gravity: 0.4,
                                bounce: 0.6,
                                floating: 40,
                                isPhysics: true
                            });
                        }
                    }
                    setTimeout(() => { brick.x = -1000; }, 100);
                }
            }
        }
    }
    // 落地时重置跳跃次数
    if (mario.onGround) {
        mario.jumpCount = 0;
    }

    // 边界限制
    if (mario.x < 0) mario.x = 0;
    if (mario.x + mario.width > worldWidth) mario.x = worldWidth - mario.width;
    if (mario.y + mario.height > canvas.height) {
        mario.y = canvas.height - mario.height;
        mario.vy = 0;
        mario.onGround = true;
        mario.jumpCount = 0;
    }

    // 更新无敌时间
    if (mario.invincibleTime > 0) {
        mario.invincibleTime--;
    }

    // 敌人移动和掉落逻辑
    let killedEnemiesThisFrame = 0;  // 记录这一帧踩死的敌人数
    let enemiesKilledThisJump = [];  // 记录这一跳踩到的所有敌人
    
    // 只有在非升旗状态下才更新敌人位置
    if (!flagRaising) {
        // 先检查所有可能被踩到的敌人
        for (let i = enemies.length - 1; i >= 0; i--) {
            let enemy = enemies[i];
            if (rectsCollide(mario, enemy) && 
                mario.vy > 0 && 
                mario.y + mario.height - enemy.y < STOMP_MARGIN) {
                enemiesKilledThisJump.push(enemy);
            }
        }

        // 如果有击杀，一次性处理所有被踩到的敌人
        if (enemiesKilledThisJump.length > 0) {
            killedEnemiesThisFrame = enemiesKilledThisJump.length;
            enemies = enemies.filter(enemy => !enemiesKilledThisJump.includes(enemy));
            
            // 设置无敌时间
            mario.invincibleTime = INVINCIBLE_FRAMES;
            
            // 根据连杀数处理奖励
            if (killedEnemiesThisFrame >= 4) {
                mario.vy = -JUMP_POWER * 1.2;
                score += killedEnemiesThisFrame * 10;
                const killText = {
                    x: mario.x,
                    y: mario.y - 40,
                    vy: -2,
                    alpha: 1,
                    life: 60,
                    text: `${killedEnemiesThisFrame}连杀！+${killedEnemiesThisFrame * 10}`
                };
                specialEffects.push(killText);
            } else if (killedEnemiesThisFrame === 3) {
                mario.vy = -JUMP_POWER * 1.1; // 三杀反弹较高
                score += 30;
                const killText = {
                    x: mario.x,
                    y: mario.y - 40,
                    vy: -2,
                    alpha: 1,
                    life: 60,
                    text: "三杀！+30"
                };
                specialEffects.push(killText);
            } else if (killedEnemiesThisFrame === 2) {
                mario.vy = -JUMP_POWER; // 双杀反弹高
                score += 15;
                const killText = {
                    x: mario.x,
                    y: mario.y - 40,
                    vy: -2,
                    alpha: 1,
                    life: 60,
                    text: "双杀！+15"
                };
                specialEffects.push(killText);
            } else {
                mario.vy = -JUMP_POWER / 1.5; // 单杀普通反弹
                score += 5;
            }
            killSound.currentTime = 0;
            killSound.play();
        }

        // 正常的敌人更新逻辑
        for (let i = enemies.length - 1; i >= 0; i--) {
            let enemy = enemies[i];
            if (!enemy.onGround) {
                // 敌人在空中，应用重力
                enemy.vy = (enemy.vy || 0) + GRAVITY;
                enemy.y += enemy.vy;
                // 检查是否落到地面
                if (enemy.y + enemy.height >= platforms[0].y) {
                    enemy.y = platforms[0].y - enemy.height;
                    enemy.vy = 0;
                    enemy.onGround = true;
                }
            } else {
                // 敌人在平台/砖块/地面上，左右移动
                enemy.x += enemy.vx * enemy.dir;
                let onPlatform = false;
                let currentSurface = null;
                for (let plat of platforms) {
                    if (
                        enemy.x + enemy.width > plat.x &&
                        enemy.x < plat.x + plat.width &&
                        enemy.y + enemy.height === plat.y
                    ) {
                        onPlatform = true;
                        currentSurface = plat;
                    }
                }
                for (let brick of bricks) {
                    if (
                        enemy.x + enemy.width > brick.x &&
                        enemy.x < brick.x + brick.width &&
                        enemy.y + enemy.height === brick.y
                    ) {
                        onPlatform = true;
                        currentSurface = brick;
                    }
                }
                // 检查是否到达边缘
                if (onPlatform && currentSurface) {
                    if (
                        (enemy.dir > 0 && enemy.x + enemy.width >= currentSurface.x + currentSurface.width) ||
                        (enemy.dir < 0 && enemy.x <= currentSurface.x)
                    ) {
                        // 0.5概率掉落
                        if (Math.random() < 0.5 && currentSurface !== platforms[0]) {
                            enemy.onGround = false;
                            enemy.vy = 0;
                        } else {
                            enemy.dir *= -1;
                            // 防止卡边
                            if (enemy.dir > 0) enemy.x = currentSurface.x;
                            else enemy.x = currentSurface.x + currentSurface.width - enemy.width;
                        }
                    }
                } else {
                    // 不在平台上，掉头
                    enemy.dir *= -1;
                }
                // 边界限制
                if (enemy.x < 0) enemy.x = 0;
                if (enemy.x + enemy.width > worldWidth) enemy.x = worldWidth - enemy.width;
            }
        }
    }
    
    // 敌人与马里奥碰撞（只在非无敌时检查致死碰撞）
    for (let enemy of enemies) {
        if (rectsCollide(mario, enemy) && 
            (mario.vy <= 0 || mario.y + mario.height - enemy.y >= STOMP_MARGIN)) {
            if (!gameOver && mario.invincibleTime <= 0) {  // 只有在非无敌状态才会死亡
                gameoverSound.play();
                gameOver = true;
                gamePaused = true;
            }
        }
    }

    // 金币收集
    for (let coin of coins) {
        if (!coin.collected && rectsCollide(mario, coin)) {
            coin.collected = true;
            score++;
            coinSound.currentTime = 0;
            coinSound.play();
        }
    }

    // 金币物理动画
    for (let coin of coins) {
        if (coin.isPhysics) {
            coin.x += coin.vx;
            coin.y += coin.vy;
            coin.vy += coin.gravity;
            // 落地弹起
            if (coin.y + coin.height > platforms[0].y) {
                coin.y = platforms[0].y - coin.height;
                if (Math.abs(coin.vy) > 1) {
                    coin.vy = -coin.vy * coin.bounce;
                } else {
                    coin.vy = 0;
                    coin.isPhysics = false;
                }
            }
        }
        if (coin.floating && !coin.isPhysics) {
            coin.y -= 1;
            coin.floating--;
        }
    }

    // 旗子碰撞与升旗
    if (flag && rectsCollide(mario, { x: flag.x, y: flag.y, width: flag.width, height: flag.height })) {
        if (!flagRaising && !levelPassed) {
            flagRaising = true;
            mario.vx = 0;  // 停止马里奥的水平移动
            mario.x = flag.x - mario.width/2;  // 将马里奥固定在旗杆位置
            mario.vy = 2;  // 设置一个缓慢的下落速度
            flagSound.currentTime = 0;
            flagSound.play();
            // 创建升旗粒子效果
            for (let i = 0; i < 20; i++) {
                flagParticles.push({
                    x: flag.x + flag.width/2,
                    y: flagY,
                    vx: (Math.random() - 0.5) * 4,
                    vy: -Math.random() * 3 - 2,
                    life: 60 + Math.random() * 30,
                    color: Math.random() < 0.5 ? '#fff' : '#ff0'
                });
            }
        }
        
        // 如果马里奥还没有到达地面，继续下滑
        if (mario.y + mario.height < platforms[0].y) {
            mario.x = flag.x - mario.width/2;  // 保持在旗杆位置
        } else {
            // 到达地面后停止下滑
            mario.y = platforms[0].y - mario.height;
            mario.vy = 0;
            if (!levelPassed) {
                triggerNextLevel();
            }
        }
    }

    // 过关判定：马里奥到达最右侧
    if (!levelPassed && mario.x + mario.width >= worldWidth - 10) {
        triggerNextLevel();
    }
}

function draw() {
    // 视口跟随马里奥
    let viewX = Math.max(0, Math.min(mario.x + mario.width/2 - canvas.width/2, worldWidth - canvas.width));
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (levelSelectionMode) {
        // 绘制选关界面
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#fff';
        ctx.font = '36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('选择关卡', canvas.width/2, 80);
        
        const LEVELS_PER_ROW = 5;  // 每行显示5个关卡
        const BUTTON_WIDTH = 80;
        const BUTTON_HEIGHT = 40;
        const BUTTON_MARGIN = 20;
        const ROWS = Math.ceil(TOTAL_LEVELS / LEVELS_PER_ROW);
        
        // 显示所有15关
        for (let i = 0; i < TOTAL_LEVELS; i++) {
            const levelNum = i + 1;
            const row = Math.floor(i / LEVELS_PER_ROW);
            const col = i % LEVELS_PER_ROW;
            
            const x = canvas.width/2 + (col - LEVELS_PER_ROW/2) * (BUTTON_WIDTH + BUTTON_MARGIN);
            const y = 150 + row * (BUTTON_HEIGHT + BUTTON_MARGIN);
            
            const button = {
                x: x - BUTTON_WIDTH/2,
                y: y - BUTTON_HEIGHT/2,
                width: BUTTON_WIDTH,
                height: BUTTON_HEIGHT,
                level: levelNum
            };
            
            // 根据关卡是否解锁设置不同颜色
            if (levelNum <= maxUnlockedLevel) {
                ctx.fillStyle = level === levelNum ? '#87CEEB' : '#4682B4';
            } else {
                ctx.fillStyle = '#808080'; // 未解锁的关卡显示为灰色
            }
            ctx.fillRect(button.x, button.y, button.width, button.height);
            
            ctx.fillStyle = levelNum <= maxUnlockedLevel ? '#fff' : '#ccc';
            ctx.font = '20px Arial';
            ctx.fillText(levelNum, x, y + 7);
        }
        
        // 返回按钮
        const backBtn = {
            x: canvas.width/2 - 60,
            y: canvas.height - 80,
            width: 120,
            height: 40
        };
        ctx.fillStyle = '#B0E2FF';
        ctx.fillRect(backBtn.x, backBtn.y, backBtn.width, backBtn.height);
        ctx.fillStyle = '#000';
        ctx.fillText('返回游戏', canvas.width/2, backBtn.y + 28);
        
        // 添加点击事件处理
        canvas.onclick = function(e) {
            if (!levelSelectionMode) return;
            
            const rect = canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            
            // 检查是否点击了关卡按钮
            for (let i = 0; i < TOTAL_LEVELS; i++) {
                const levelNum = i + 1;
                const row = Math.floor(i / LEVELS_PER_ROW);
                const col = i % LEVELS_PER_ROW;
                const x = canvas.width/2 + (col - LEVELS_PER_ROW/2) * (BUTTON_WIDTH + BUTTON_MARGIN) - BUTTON_WIDTH/2;
                const y = 150 + row * (BUTTON_HEIGHT + BUTTON_MARGIN) - BUTTON_HEIGHT/2;
                
                if (clickX >= x && clickX <= x + BUTTON_WIDTH &&
                    clickY >= y && clickY <= y + BUTTON_HEIGHT) {
                    level = levelNum;
                    levelSelectionMode = false;
                    gamePaused = false;
                    startLockCountdown();
                    initLevel();
                    canvas.onclick = null;
                    return;
                }
            }
            
            // 检查是否点击了返回按钮
            if (clickX >= backBtn.x && clickX <= backBtn.x + backBtn.width &&
                clickY >= backBtn.y && clickY <= backBtn.y + backBtn.height) {
                levelSelectionMode = false;
                gamePaused = false;
                canvas.onclick = null;
            }
        };
        
        return;  // 在选关模式下不绘制游戏场景
    }

    // 倒计时显示（提前，确保始终可见）
    if (inputLocked) {
        let remain = Math.ceil((lockEndTime - Date.now()) / 1000);
        if (remain > 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#fff';
            ctx.font = '80px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(remain, canvas.width/2, canvas.height/2+30);
            ctx.textAlign = 'left';
        }
    }

    // 画平台
    ctx.fillStyle = '#654321';
    for (let plat of platforms) {
        ctx.fillRect(plat.x - viewX, plat.y, plat.width, plat.height);
    }

    // 画砖块
    for (let brick of bricks) {
        if (brick.x > -100) {
            ctx.fillStyle = brick.unbreakable ? '#444' : (brick.hit ? '#aaa' : '#c96');
            ctx.fillRect(brick.x - viewX, brick.y, brick.width, brick.height);
            ctx.strokeStyle = '#fff';
            ctx.strokeRect(brick.x - viewX, brick.y, brick.width, brick.height);
        }
    }

    // 画金币
    for (let coin of coins) {
        if (!coin.collected) {
            ctx.beginPath();
            ctx.arc(coin.x + coin.width/2 - viewX, coin.y + coin.height/2, coin.width/2, 0, Math.PI*2);
            ctx.fillStyle = 'gold';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.stroke();
        }
    }

    // 画敌人
    for (let enemy of enemies) {
        if (enemyImg.complete && enemyImg.naturalWidth > 0) {
            ctx.drawImage(enemyImg, enemy.x - viewX, enemy.y, enemy.width, enemy.height);
        } else {
            ctx.fillStyle = '#228b22';
            ctx.fillRect(enemy.x - viewX, enemy.y, enemy.width, enemy.height);
        }
    }

    // 画马里奥（无敌状态闪烁）
    if (marioImg.complete && marioImg.naturalWidth > 0) {
        if (mario.invincibleTime <= 0 || mario.invincibleTime % 6 < 3) {  // 闪烁效果
            ctx.drawImage(marioImg, mario.x - viewX, mario.y, mario.width, mario.height);
        }
    } else {
        if (mario.invincibleTime <= 0 || mario.invincibleTime % 6 < 3) {
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(mario.x - viewX, mario.y, mario.width, mario.height);
        }
    }

    // 画旗子
    if (flag) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(flag.x - viewX + flag.width / 2 - 2, flag.y, 4, flag.height);
        ctx.fillStyle = '#f00';
        ctx.fillRect(flag.x - viewX + flag.width / 2, flagY, 18, 12);
        
        // 绘制粒子
        for (const particle of flagParticles) {
            ctx.fillStyle = particle.color;
            ctx.globalAlpha = particle.life / 90;  // 粒子逐渐消失
            ctx.beginPath();
            ctx.arc(particle.x - viewX, particle.y, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;  // 恢复透明度
    }

    // 分数和关卡
    ctx.fillStyle = '#fff';
    ctx.font = '20px Arial';
    ctx.fillText('分数: ' + score, 20, 30);
    ctx.fillText('关卡: ' + level, 140, 30);

    // Game Over 界面
    if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 游戏结束文字
        ctx.fillStyle = '#fff';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        
        if (level > TOTAL_LEVELS) {
            // 显示通关祝贺
            ctx.fillText('恭喜通关！', canvas.width/2, canvas.height/2 - 100);
            ctx.font = '32px Arial';
            ctx.fillText('你已完成了所有15关！', canvas.width/2, canvas.height/2 - 40);
            ctx.fillText('最终得分: ' + score, canvas.width/2, canvas.height/2 + 20);
        } else {
            ctx.fillText('游戏结束', canvas.width/2, canvas.height/2 - 50);
            ctx.fillText('得分: ' + score, canvas.width/2, canvas.height/2 + 20);
        }
        
        // 再玩一次按钮
        const restartBtn = {
            x: canvas.width/2 - 100,
            y: canvas.height/2 + 80,
            width: 200,
            height: 40
        };
        // 根据手柄选择状态改变颜色
        ctx.fillStyle = (gamepadConnected && selectedOption === 0) ? '#4CA6FF' : '#87CEEB';
        ctx.fillRect(restartBtn.x, restartBtn.y, restartBtn.width, restartBtn.height);
        ctx.fillStyle = '#000';
        ctx.font = '20px Arial';
        ctx.fillText('再玩一次', canvas.width/2, restartBtn.y + 28);
        
        // 退出游戏按钮
        const quitBtn = {
            x: canvas.width/2 - 100,
            y: canvas.height/2 + 140,
            width: 200,
            height: 40
        };
        // 根据手柄选择状态改变颜色
        ctx.fillStyle = (gamepadConnected && selectedOption === 1) ? '#7AC5FF' : '#B0E2FF';
        ctx.fillRect(quitBtn.x, quitBtn.y, quitBtn.width, quitBtn.height);
        ctx.fillStyle = '#000';
        ctx.fillText('退出游戏', canvas.width/2, quitBtn.y + 28);

        // 如果连接了手柄，显示操作提示
        if (gamepadConnected) {
            ctx.fillStyle = '#fff';
            ctx.font = '16px Arial';
            ctx.fillText('使用方向键选择，A键确认', canvas.width/2, quitBtn.y + 80);
        }
        
        // 添加按钮点击事件
        canvas.onclick = function(e) {
            const rect = canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            
            // 检查是否点击了再玩一次按钮
            if (clickX >= restartBtn.x && clickX <= restartBtn.x + restartBtn.width &&
                clickY >= restartBtn.y && clickY <= restartBtn.y + restartBtn.height) {
                canvas.onclick = null;  // 移除点击事件
                resetGame();
            }
            // 检查是否点击了退出游戏按钮
            else if (clickX >= quitBtn.x && clickX <= quitBtn.x + quitBtn.width &&
                     clickY >= quitBtn.y && clickY <= quitBtn.y + quitBtn.height) {
                canvas.onclick = null;  // 移除点击事件
                window.close();  // 尝试关闭窗口
                // 如果window.close()不起作用，显示提示
                alert('请直接关闭浏览器窗口来退出游戏');
            }
        };
    } else {
        canvas.onclick = null;  // 游戏未结束时移除点击事件
    }

    // 过关提示
    if (levelPassed && !gameOver) {
        // 只在升旗动画完成后显示过关提示
        if (!flagRaising || flagY <= flag.y) {
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#fff';
            ctx.font = '36px Arial';
            ctx.fillText('过关！', canvas.width/2-60, canvas.height/2);
        }
    }

    // 绘制特效
    for (let i = specialEffects.length - 1; i >= 0; i--) {
        const effect = specialEffects[i];
        if (effect.life > 0) {
            ctx.fillStyle = `rgba(255, 215, 0, ${effect.alpha})`;  // 金色
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(effect.text, effect.x - viewX, effect.y);
            effect.y += effect.vy;
            effect.alpha -= 0.02;
            effect.life--;
        } else {
            specialEffects.splice(i, 1);
        }
    }

    // 在移动设备上绘制虚拟按钮
    if (isMobile && !gameOver && !levelSelectionMode) {
        // 绘制半透明的控制按钮
        ctx.globalAlpha = 0.5;
        
        // 左箭头按钮
        ctx.fillStyle = virtualButtons.left.pressed ? '#87CEEB' : '#4682B4';
        ctx.beginPath();
        ctx.moveTo(virtualButtons.left.x + virtualButtons.left.width, virtualButtons.left.y);
        ctx.lineTo(virtualButtons.left.x + virtualButtons.left.width, virtualButtons.left.y + virtualButtons.left.height);
        ctx.lineTo(virtualButtons.left.x, virtualButtons.left.y + virtualButtons.left.height/2);
        ctx.closePath();
        ctx.fill();
        
        // 右箭头按钮
        ctx.fillStyle = virtualButtons.right.pressed ? '#87CEEB' : '#4682B4';
        ctx.beginPath();
        ctx.moveTo(virtualButtons.right.x, virtualButtons.right.y);
        ctx.lineTo(virtualButtons.right.x, virtualButtons.right.y + virtualButtons.right.height);
        ctx.lineTo(virtualButtons.right.x + virtualButtons.right.width, virtualButtons.right.y + virtualButtons.right.height/2);
        ctx.closePath();
        ctx.fill();
        
        // 跳跃按钮
        ctx.fillStyle = virtualButtons.jump.pressed ? '#87CEEB' : '#4682B4';
        ctx.beginPath();
        ctx.arc(virtualButtons.jump.x + virtualButtons.jump.width/2, 
                virtualButtons.jump.y + virtualButtons.jump.height/2,
                virtualButtons.jump.width/2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '24px Arial';
        ctx.fillText('跳', virtualButtons.jump.x + virtualButtons.jump.width/2 - 12,
                    virtualButtons.jump.y + virtualButtons.jump.height/2 + 8);
        
        // 菜单按钮
        ctx.fillStyle = virtualButtons.menu.pressed ? '#87CEEB' : '#4682B4';
        ctx.fillRect(virtualButtons.menu.x, virtualButtons.menu.y,
                    virtualButtons.menu.width, virtualButtons.menu.height);
        ctx.fillStyle = '#fff';
        ctx.font = '20px Arial';
        ctx.fillText('L', virtualButtons.menu.x + virtualButtons.menu.width/2 - 6,
                    virtualButtons.menu.y + virtualButtons.menu.height/2 + 6);
        
        ctx.globalAlpha = 1.0;
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// 修改canvas的点击处理，支持移动设备的选关界面
function initTouchControls() {
    canvas.addEventListener('pointerdown', function(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (gameOver) {
            // Game Over 界面的按钮处理
            const restartBtn = {
                x: canvas.width/2 - 100,
                y: canvas.height/2 + 80,
                width: 200,
                height: 40
            };
            const quitBtn = {
                x: canvas.width/2 - 100,
                y: canvas.height/2 + 140,
                width: 200,
                height: 40
            };
            
            if (x >= restartBtn.x && x <= restartBtn.x + restartBtn.width &&
                y >= restartBtn.y && y <= restartBtn.y + restartBtn.height) {
                resetGame();
            } else if (x >= quitBtn.x && x <= quitBtn.x + quitBtn.width &&
                       y >= quitBtn.y && y <= quitBtn.y + quitBtn.height) {
                window.close();
                alert('请直接关闭浏览器窗口来退出游戏');
            }
        } else if (levelSelectionMode) {
            // 选关界面的按钮处理
            const LEVELS_PER_ROW = 5;
            const BUTTON_WIDTH = 80;
            const BUTTON_HEIGHT = 40;
            const BUTTON_MARGIN = 20;
            
            // 检查关卡按钮
            for (let i = 0; i < TOTAL_LEVELS; i++) {
                const levelNum = i + 1;
                const row = Math.floor(i / LEVELS_PER_ROW);
                const col = i % LEVELS_PER_ROW;
                const btnX = canvas.width/2 + (col - LEVELS_PER_ROW/2) * (BUTTON_WIDTH + BUTTON_MARGIN) - BUTTON_WIDTH/2;
                const btnY = 150 + row * (BUTTON_HEIGHT + BUTTON_MARGIN) - BUTTON_HEIGHT/2;
                
                if (x >= btnX && x <= btnX + BUTTON_WIDTH &&
                    y >= btnY && y <= btnY + BUTTON_HEIGHT &&
                    levelNum <= maxUnlockedLevel) {
                    level = levelNum;
                    levelSelectionMode = false;
                    gamePaused = false;
                    startLockCountdown();
                    initLevel();
                    return;
                }
            }
            
            // 返回按钮
            const backBtn = {
                x: canvas.width/2 - 60,
                y: canvas.height - 80,
                width: 120,
                height: 40
            };
            
            if (x >= backBtn.x && x <= backBtn.x + backBtn.width &&
                y >= backBtn.y && y <= backBtn.y + backBtn.height) {
                levelSelectionMode = false;
                gamePaused = false;
            }
        }
    });
}

// 初始化触摸控制
initTouchControls(); 