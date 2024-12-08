from fastapi import FastAPI, Query, HTTPException, Body
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
    allow_methods=["*"],
    allow_headers=["*"],
)

db = Database()

@app.get("/api/houses/on-sale")
async def get_on_sale_houses(
    community: Optional[str] = Query(None, description="小区名称"),
    skip: int = Query(0, description="跳过的记录数"),
    limit: int = Query(10, description="返回的记录数")
):
    try:
        logger.info(f"开始获取在售房源数据 - 小区: {community}, skip: {skip}, limit: {limit}")
        query = {}
        if community:
            query["小区名"] = community
        logger.info(f"数据库查询条件: {query}")
        houses = db.get_on_sale_houses(query, skip, limit)
        return {"data": houses}
    except Exception as e:
        error_msg = f"获取在售房源数据时出错: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)

@app.get("/api/houses/sold")
async def get_sold_houses(
    community: Optional[str] = Query(None, description="小区名称"),
    skip: int = Query(0, description="跳过的记录数"),
    limit: int = Query(10, description="返回的记录数")
):
    try:
        logger.info(f"开始获取成交房源数据 - 小区: {community}, skip: {skip}, limit: {limit}")
        query = {}
        if community:
            query["小区名"] = community
        logger.info(f"数据库查询条件: {query}")
        houses = db.get_sold_houses(query, skip, limit)
        return {"data": houses}
    except Exception as e:
        error_msg = f"获取成交房源数据时出错: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)

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
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
