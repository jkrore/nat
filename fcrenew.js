import puppeteer from 'puppeteer-core';
import chromium from 'chrome-aws-lambda';

// 从环境变量读取配置
const accountsString = process.env.FREECLOUD_ACCOUNTS;

async function run() {
    if (!accountsString) {
        console.error("❌ 错误: 未找到 FREECLOUD_ACCOUNTS 环境变量。");
        process.exit(1);
    }

    let accounts;
    try {
        accounts = JSON.parse(accountsString);
    } catch (e) {
        console.error("❌ 错误: FREECLOUD_ACCOUNTS 格式不正确，请确保是有效的JSON。");
        process.exit(1);
    }

    const account = accounts.find(acc => acc.type === 'nat.freecloud');

    if (!account) {
        console.error("❌ 错误: 在配置中未找到 type 为 'nat.freecloud' 的账号。");
        process.exit(1);
    }

    const { username, password } = account;
    console.log(`🚀 开始为账号 [${username}] 执行自动签到...`);

    let browser = null;
    try {
        // 启动浏览器
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath,
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // 1. 登录
        console.log("🔄 步骤1: 正在登录...");
        await page.goto('https://nat.freecloud.ltd/login', { waitUntil: 'networkidle2' });
        await page.type('input[name="username"]', username);
        await page.type('input[name="password"]', password);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            page.click('button[type="submit"]')
        ]);
        
        if (page.url().includes('login')) {
            console.error("❌ 登录失败: 请检查你的用户名和密码是否正确。");
            throw new Error("登录失败");
        }
        console.log("✅ 登录成功!");

        // 2. 前往签到中心
        console.log("🔄 步骤2: 前往签到中心...");
        await page.goto('https://nat.freecloud.ltd/addons?_plugin=19&_controller=index&_action=index', { waitUntil: 'networkidle2' });
        
        // 检查是否已经签到
        const alreadyCheckedIn = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            return bodyText.includes('今天你已经签到过了');
        });

        if (alreadyCheckedIn) {
            console.log("👍 今天已经签到过了，任务完成！");
            return;
        }

        // 3. 解决数学题
        console.log("🔄 步骤3: 解决人机验证 (数学题)...");
        const questionText = await page.$eval('body', el => {
            const match = el.innerText.match(/请计算：(.*)/);
            return match ? match[1].trim() : null;
        });

        if (!questionText) {
            console.error("❌ 错误: 未在页面上找到数学题。");
            throw new Error("未找到数学题");
        }
        
        // 使用 eval 计算答案，移除所有非数学字符
        const mathExpression = questionText.replace(/[^-()\d/*+.]/g, '');
        const answer = eval(mathExpression);
        console.log(`🧮 题目是 "${questionText}", 计算出的答案是: ${answer}`);

        await page.type('input[placeholder="请输入答案"]', String(answer));
        await page.click('button:nth-of-type(2)'); // 点击“验证答案”

        // 等待验证成功的弹窗
        await page.waitForFunction(() => document.body.innerText.includes('验证成功'));
        console.log("✅ 数学题验证成功!");
        await page.click('button.layui-layer-btn0'); // 点击弹窗的“确定”

        // 4. 点击签到
        console.log("🔄 步骤4: 点击签到...");
        await page.click('button.btn.btn-primary');
        
        // 等待最终结果
        await page.waitForFunction(() => document.body.innerText.includes('签到成功') || document.body.innerText.includes('今天你已经签到过了'));
        console.log("💰 签到成功!");

    } catch (error) {
        console.error("❌ 自动化流程执行失败:", error.message);
        process.exit(1);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
    console.log("🎉 所有任务已成功完成！");
}

run();
