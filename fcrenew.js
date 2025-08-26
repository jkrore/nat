import axios from 'axios';
import tough from 'tough-cookie';
import { HttpsProxyAgent } from 'https-proxy-agent';

// 青龙/本地 环境变量
let freecloudAccounts = process.env.FREECLOUD_ACCOUNTS;
let freecloudApiKey = process.env.FREECLOUD_API_KEY;
let telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
let telegramChatId = process.env.TELEGRAM_CHAT_ID;
let proxyUrl = process.env.PROXY_URL; // 支持代理

// Github Actions 环境变量
if (!freecloudAccounts) {
    freecloudAccounts = process.env.INPUT_FREECLOUD_ACCOUNTS;
    freecloudApiKey = process.env.INPUT_FREECLOUD_API_KEY;
    telegramBotToken = process.env.INPUT_TELEGRAM_BOT_TOKEN;
    telegramChatId = process.env.INPUT_TELEGRAM_CHAT_ID;
    proxyUrl = process.env.INPUT_PROXY_URL;
}

const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36";

class FreeCloud {
    constructor(account) {
        this.type = account.type;
        this.username = account.username;
        this.password = account.password;
        this.port = account.port; // 对于 nat.freecloud, port 就是 uid
        this.cookieJar = new tough.CookieJar();
        this.axiosInstance = axios.create({
            withCredentials: true,
            jar: this.cookieJar,
            headers: {
                'User-Agent': userAgent,
            },
            // 支持代理
            httpsAgent: proxyUrl ? new HttpsProxyAgent(proxyUrl) : null,
        });
    }

    async log(message) {
        console.log(message);
    }

    async login() {
        const loginUrl = `https://nat.freecloud.ltd/login`;
        const loginData = new URLSearchParams({
            username: this.username,
            password: this.password,
        }).toString();

        try {
            const response = await this.axiosInstance.post(loginUrl, loginData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': 'https://nat.freecloud.ltd/login'
                },
                maxRedirects: 0, 
                validateStatus: function (status) {
                    return status >= 200 && status < 400; 
                },
            });

            if (response.status === 302 && response.headers.location.includes('clientarea')) {
                await this.log(`✅ 账号 [${this.username}] 登录成功`);
                return true;
            } else {
                if (response.data && response.data.includes('密码错误')) {
                     await this.log(`❌ 账号 [${this.username}] 登录失败: 密码错误`);
                } else {
                     await this.log(`❌ 账号 [${this.username}] 登录失败: 凭据无效或未知错误`);
                }
                return false;
            }
        } catch (error) {
            await this.log(`❌ 账号 [${this.username}] 登录请求失败: ${error.message}`);
            return false;
        }
    }

    async checkIn() {
        const checkInUrl = 'https://nat.freecloud.ltd/addons?_plugin=19&_controller=index&_action=index';
        const checkInData = new URLSearchParams({
            uid: this.port
        }).toString();

        try {
            const response = await this.axiosInstance.post(checkInUrl, checkInData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': checkInUrl,
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            const data = response.data;
            if (data.code === 200) {
                await this.log(`💰 账号 [${this.username}] 签到成功: ${data.msg}`);
                return { success: true, message: data.msg };
            } else if (data.msg && data.msg.includes('已经签到过了')) {
                await this.log(`👍 账号 [${this.username}] 今日已签到: ${data.msg}`);
                return { success: true, message: data.msg };
            } else {
                await this.log(`❌ 账号 [${this.username}] 签到失败: ${data.msg || '未知错误'}`);
                return { success: false, message: data.msg || '未知错误' };
            }
        } catch (error) {
            await this.log(`❌ 账号 [${this.username}] 签到请求失败: ${error.message}`);
            return { success: false, message: error.message };
        }
    }

    async run() {
        if (this.type !== 'nat.freecloud') {
            await this.log(`🟡 跳过不支持的账号类型: ${this.type}`);
            return { success: false, message: '不支持的类型' };
        }

        const loginSuccess = await this.login();
        if (!loginSuccess) {
            return { success: false, message: '登录失败' };
        }
        await new Promise(resolve => setTimeout(resolve, 2000)); 
        return await this.checkIn();
    }
}

async function main() {
    if (!freecloudAccounts) {
        console.log('❌ 未找到 FREECLOUD_ACCOUNTS 环境变量, 任务终止');
        return;
    }

    let accounts;
    try {
        accounts = JSON.parse(freecloudAccounts);
    } catch (e) {
        console.log('❌ FREECLOUD_ACCOUNTS 环境变量格式错误, 请检查JSON格式');
        return;
    }

    console.log(`📋 读取到 ${accounts.length} 个账号`);
    let successCount = 0;
    let failCount = 0;

    for (const account of accounts) {
        console.log(`\n🚀 开始处理账号: [${account.username}]`);
        const client = new FreeCloud(account);
        const result = await client.run();
        if (result.success) {
            successCount++;
        } else {
            failCount++;
        }
    }

    console.log(`\n📊 处理结果: 总计 ${accounts.length} 个账号, 成功 ${successCount} 个, 失败 ${failCount} 个`);
    if (failCount > 0) {
        process.exit(1);
    }
}

main();
