# 美房宝 - 房源数据分析系统

## 项目简介
美房宝是一个专业的房源数据分析系统，提供在售房源和成交房源的数据查询、分析和可视化功能。系统支持多城市房源数据的采集和展示，帮助用户更好地了解房地产市场动态。

## 功能特点
- 在售房源数据查询和展示
- 成交房源历史记录查询
- 房源数据可视化分析
- 多维度数据筛选（户型、楼层等）
- 支持多城市数据
- 投资测算工具
- 响应式设计，支持移动端访问

## 技术栈
### 后端
- Python 3.12
- FastAPI
- MongoDB
- Gunicorn
- Uvicorn

### 前端
- Vue.js 3
- Element Plus
- Bootstrap 5
- ECharts
- Axios

### 部署
- Nginx
- SSL/HTTPS
- Ubuntu Server

## 项目结构
```
targethouse/
├── frontend/                 # 前端文件
│   ├── static/              # 静态资源
│   ├── js/                  # JavaScript文件
│   │   ├── app.js          # 主应用逻辑
│   │   └── calculator.js    # 投资计算器逻辑
│   ├── index.html          # 主页面
│   └── style.css           # 样式文件
├── main.py                  # FastAPI应用入口
├── database.py             # 数据库操作
├── spider.py               # 数据爬虫
├── gunicorn_config.py      # Gunicorn配置
├── requirements.txt        # Python依赖
└── targethouse.service     # Systemd服务配置
```

## 安装部署
### 1. 环境要求
- Python 3.12+
- MongoDB 4.4+
- Nginx 1.18+

### 2. 安装依赖
```bash
# 创建虚拟环境
python -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 3. 配置MongoDB
```javascript
# 创建数据库用户
use targethouse
db.createUser({
    user: "username",
    pwd: "password",
    roles: ["readWrite"]
})
```

### 4. 配置Nginx
```bash
# 复制Nginx配置
sudo cp targethouse /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/targethouse /etc/nginx/sites-enabled/

# 配置SSL证书
# 将证书文件放置在指定位置
```

### 5. 配置系统服务
```bash
# 复制服务配置
sudo cp targethouse.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable targethouse
```

### 6. 启动服务
```bash
# 启动MongoDB
sudo systemctl start mongod

# 启动应用服务
sudo systemctl start targethouse

# 启动Nginx
sudo systemctl start nginx
```

## 配置说明
### 环境变量
创建.env文件并配置以下变量：
```
MONGO_USERNAME=your_username
MONGO_PASSWORD=your_password
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_AUTH_SOURCE=admin
```

### Nginx配置
主要配置项：
- SSL证书配置
- 反向代理设置
- CORS策略
- 静态文件处理

### Gunicorn配置
主要配置项：
- 工作进程数
- 超时设置
- 日志配置
- 代理设置

## API接口
### 获取在售房源
```
GET /api/houses/on-sale
```

### 获取成交房源
```
GET /api/houses/sold
```

查询参数：
- `community`: 小区名称（必填）
- `city`: 城市名称（必填）
- `skip`: 跳过记录数（默认0）
- `limit`: 返回记录数（默认10）

## 使用说明
1. 访问系统：https://www.hitoday.top
2. 输入小区名称进行搜索
3. 使用筛选器过滤数据
4. 查看数据可视化图表
5. 使用投资计算器进行分析

## 维护说明
### 日志位置
- Nginx日志：/var/log/nginx/
- 应用日志：/var/log/targethouse/

### 常用维护命令
```bash
# 查看服务状态
sudo systemctl status targethouse

# 重启服务
sudo systemctl restart targethouse

# 查看日志
sudo tail -f /var/log/targethouse/error.log
```

## 安全说明
- 已启用HTTPS
- 已配置CORS策略
- 已启用HSTS
- 已配置适当的请求限制

## 数据采集
系统包含一个Chrome扩展用于数据采集：
1. 在Chrome中加载扩展
2. 访问目标房源页面
3. 点击扩展图标开始采集
4. 数据会自动保存到数据库

## 许可证
MIT License

## 联系方式
如有问题或建议，请联系开发团队。

## 更新日志
### v1.0.0 (2024-12-12)
- 初始版本发布
- 支持基础房源数据查询
- 添加投资计算器功能
- 实现数据可视化
- 支持HTTPS访问
