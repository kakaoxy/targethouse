from fastapi import FastAPI, Query, HTTPException, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import List, Optional, Dict
from database import Database
import uvicorn
import os
import traceback
import logging
import sys
from fastapi.responses import JSONResponse
from datetime import datetime

# 配置日志
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('app.log')
    ]
)

logger = logging.getLogger(__name__)

app = FastAPI(title="房源数据API", description="查询在售房源和成交房源信息")

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Length", "Content-Range"]
)

# 添加中间件来处理代理头信息
@app.middleware("http")
async def add_process_proxy_headers(request: Request, call_next):
    # 记录请求信息
    logger.debug(f"收到请求: {request.method} {request.url}")
    logger.debug(f"请求头: {request.headers}")
    
    # 更安全的客户端地址处理
    try:
        forwarded_proto = request.headers.get("X-Forwarded-Proto")
        if forwarded_proto:
            request.scope["scheme"] = forwarded_proto
            logger.debug(f"设置协议为: {forwarded_proto}")
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            # 确保client元组有两个元素
            request.scope["client"] = (real_ip, request.scope.get("client", ("0.0.0.0", 0))[1])
            logger.debug(f"设置客户端IP为: {real_ip}")
        elif "client" not in request.scope:
            # 如果没有client信息，设置一个默认值
            request.scope["client"] = ("0.0.0.0", 0)
    except Exception as e:
        logger.error(f"处理请求头时出错: {str(e)}")
        # 确保有默认的client信息
        request.scope["client"] = ("0.0.0.0", 0)
    
    response = await call_next(request)
    return response

db = Database()

@app.get("/api/houses/on-sale")
async def get_on_sale_houses(
    request: Request,  # 添加request参数以获取请求信息
    community: Optional[str] = Query(None, description="小区名称"),
    city: Optional[str] = Query(None, description="城市"),
    skip: int = Query(0, description="跳过的记录数"),
    limit: int = Query(10, description="返回的记录数")
):
    try:
        logger.debug(f"处理在售房源请求: URL={request.url}, Headers={request.headers}")
        query = {}
        if community:
            query["小区名"] = community
        if city:
            query["城市"] = city
        houses = db.get_on_sale_houses(query, skip, limit)
        return {"data": houses}
    except Exception as e:
        logger.error(f"获取在售房源数据时出错: {str(e)}\n{traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={"detail": str(e)}
        )

@app.get("/api/houses/sold")
async def get_sold_houses(
    community: Optional[str] = Query(None, description="小区名称"),
    city: Optional[str] = Query(None, description="城市"),
    skip: int = Query(0, description="跳过的记录数"),
    limit: int = Query(10, description="返回的记录数")
):
    try:
        query = {}
        if community:
            query["小区名"] = community
        if city:
            query["城市"] = city
        houses = db.get_sold_houses(query, skip, limit)
        return {"data": houses}
    except Exception as e:
        logger.error(f"获取成交房源数据时出错: {str(e)}\n{traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={"detail": str(e)}
        )

@app.post("/api/houses/sold")
async def add_sold_houses(houses: List[Dict] = Body(...)):
    """
    添加成交房源记录
    
    Args:
        houses: 成交房源记录列表，每个记录包含房源详细信息
    
    Returns:
        包含操作结果的JSON响应
    """
    try:
        logger.info(f"开始添加成交房源数据，记录数: {len(houses)}")
        
        # 添加时间戳
        for house in houses:
            house['数据创建时间'] = datetime.now()
        
        # 批量插入记录
        result = db.save_sold_houses_batch(houses)
        
        # 获取插入的记录数
        inserted_count = len(result.inserted_ids) if result else 0
        logger.info(f"成功添加 {inserted_count} 条记录")
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": f"成功添加 {inserted_count} 条记录",
                "inserted_count": inserted_count
            }
        )
        
    except Exception as e:
        error_msg = f"添加成交房源数据时出错: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)

@app.post("/api/houses/on-sale")
async def add_on_sale_houses(houses: List[Dict] = Body(...)):
    """
    添加在售房源记录
    
    Args:
        houses: 在售房源记录列表，每个记录包含房源详细信息
    
    Returns:
        包含操作结果的JSON响应
    """
    try:
        logger.info(f"开始添加在售房源数据，记录数: {len(houses)}")
        
        # 添加时间戳
        for house in houses:
            house['数据创建时间'] = datetime.now()
        
        # 批量插入记录
        result = db.save_on_sale_houses_batch(houses)
        
        # 获取插入的记录数
        inserted_count = len(result.inserted_ids) if result else 0
        logger.info(f"成功添加 {inserted_count} 条记录")
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": f"成功添加 {inserted_count} 条记录",
                "inserted_count": inserted_count
            }
        )
        
    except Exception as e:
        error_msg = f"添加在售房源数据时出错: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)

# 挂载静态文件
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)
