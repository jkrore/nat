import fetch from 'node-fetch';

const cookie = process.env.FREECLOUD_COOKIE;
const accountsString = process.env.FREECLOUD_ACCOUNTS;

async function run() {
    if (!cookie) {
        console.error("❌ 错误: 未找到 FREECLOUD_COOKIE 环境变量。这是新的关键！");
        process.exit(1);
    }
    if (!accountsString) {
        console.error("❌ 错误: 未找到 FREECLOUD_ACCOUNTS 环境变量。");
        process.exit(1);
    }

    let accounts;
    try {
        accounts = JSON.parse(accountsString);
    } catch (e) {
        console.error("❌ 错误: FREECLOUD_ACCOUNTS 格式不正确。");
        process.exit(1);
    }

    const account = accounts.find(acc => acc.type === 'nat.freecloud');
    if (!account) {
        console.error("❌ 错误: 在配置中未找到 type 为 'nat.freecloud' 的账号。");
        process.exit(1);
    }

    const uid = account.port;
    console.log(`🚀 开始为账号 [${account.username}] (UID: ${uid}) 使用Cookie进行签到...`);

    const url = 'https://nat.freecloud.ltd/addons?_plugin=19&_controller=index&_action=index';
    const body = new URLSearchParams({ uid: uid });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': `PHPSESSID=${cookie}`, // 直接使用Cookie
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: body
        });

        const data = await response.json();

        if (data.code === 200) {
            console.log(`💰 签到成功: ${data.msg}`);
        } else if (data.msg && data.msg.includes('已经签到过了')) {
            console.log(`👍 今日已签到: ${data.msg}`);
        } else {
            console.error(`❌ 签到失败: ${data.msg || '未知错误'}`);
            if (response.status !== 200 || (data.msg && data.msg.toLowerCase().includes('login'))) {
                 console.error("🔴 重要提示: Cookie可能已失效，请重新登录网站获取最新的Cookie并更新到GitHub Secrets中。");
            }
            process.exit(1);
        }
        console.log("🎉 任务已成功完成！");

    } catch (error) {
        console.error("❌ 执行签到请求时发生网络错误:", error);
        process.exit(1);
    }
}

run();
