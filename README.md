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
├── frontend/           # 前端文件
│   ├── js/            # JavaScript文件
│   ├── css/           # 样式文件
│   └── index.html     # 主页面
├── database.py        # 数据库操作
├── main.py           # FastAPI应用主文件
├── spider.py         # 数据爬虫
├── gunicorn_config.py # Gunicorn配置
└── requirements.txt   # Python依赖
```

## 安装和运行

1. 克隆项目
```bash
git clone [项目地址]
cd targethouse
```

2. 安装依赖
```bash
pip install -r requirements.txt
```

3. 配置环境变量
创建 `.env` 文件并配置以下变量：
```
MONGO_USERNAME=your_username
MONGO_PASSWORD=your_password
MONGO_HOST=your_host
MONGO_PORT=your_port
MONGO_AUTH_SOURCE=admin
```

4. 运行应用
```bash
# 开发环境
python main.py

# 生产环境
gunicorn -c gunicorn_config.py main:app
```

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
- `community`: 小区名称（可选）
- `skip`: 跳过记录数（默认0）
- `limit`: 返回记录数（默认10）

## 部署

项目使用Gunicorn作为生产环境服务器，配置文件为`gunicorn_config.py`。可以通过systemd服务（`targethouse.service`）管理应用。

## 注意事项

- 确保MongoDB服务已启动并可访问
- 生产环境部署时请修改相应的配置参数
- 注意保护好 `.env` 文件中的敏感信息

## 许可证

[许可证类型]
