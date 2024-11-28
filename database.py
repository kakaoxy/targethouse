from pymongo import MongoClient
from urllib.parse import quote_plus
from typing import Dict, List
from datetime import datetime
from bson.objectid import ObjectId
import logging
import sys
import traceback
from dotenv import load_dotenv
import os

# 加载.env文件
load_dotenv()

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

class Database:
    def __init__(self):
        try:
            MONGO_USERNAME = quote_plus(os.getenv("MONGO_USERNAME"))
            MONGO_PASSWORD = quote_plus(os.getenv("MONGO_PASSWORD"))
            MONGO_HOST = os.getenv("MONGO_HOST")
            MONGO_PORT = os.getenv("MONGO_PORT")
            MONGO_AUTH_SOURCE = os.getenv("MONGO_AUTH_SOURCE")
            
            MONGO_URI = f"mongodb://{MONGO_USERNAME}:{MONGO_PASSWORD}@{MONGO_HOST}:{MONGO_PORT}/?authSource={MONGO_AUTH_SOURCE}"
            
            self.client = MongoClient(MONGO_URI)
            # 验证连接
            self.client.server_info()
            
            # 使用targethouse数据库
            self.db = self.client.targethouse
            
            # 输出所有集合名称
            collections = self.db.list_collection_names()
            logger.info(f"数据库中的所有集合: {collections}")
            
            # 获取或创建集合
            self.collection_on_sale = self.db.ershoufang
            self.collection_sold = self.db.chengjiao
            
            logger.info("数据库连接成功")
            
            # 验证集合是否可访问
            test_query = self.collection_sold.find_one()
            if test_query:
                logger.info("成交房源集合访问正常")
                logger.info(f"示例数据: {test_query}")
            else:
                logger.warning("成交房源集合为空")
                
        except Exception as e:
            logger.error(f"数据库连接失败: {e}")
            logger.error(traceback.format_exc())
            raise

    def _ensure_indexes(self):
        """确保必要的索引存在"""
        # 在售房源索引
        self.collection_on_sale.create_index([("community_name", 1)])
        self.collection_on_sale.create_index([("floor", 1)])
        self.collection_on_sale.create_index([("building_type", 1)])
        
        # 成交房源索引
        self.collection_sold.create_index([("community_name", 1)])
        self.collection_sold.create_index([("floor", 1)])
        self.collection_sold.create_index([("building_type", 1)])

    def _normalize_house_data(self, house_data: Dict) -> Dict:
        """标准化房源数据字段名"""
        field_mapping = {
            'layout_image': '户型图',
            'community_name': '小区名',
            'house_type': '户型',
            'area': '面积',
            'total_price': '总价',
            'deal_price': '总价',  # 确保成交价映射到总价
            'unit_price': '单价',
            'floor': '楼层',
            'building_type': '建筑类型',
            'listing_date': '挂牌时间',
            'listing_price': '挂牌价',
            'deal_cycle': '成交周期'
        }
        
        normalized_data = {}
        for eng_key, cn_key in field_mapping.items():
            if eng_key in house_data:
                normalized_data[cn_key] = house_data[eng_key]
                if eng_key == 'deal_price':  # 如果有成交价，也保存为总价
                    normalized_data['总价'] = house_data[eng_key]
        
        return normalized_data

    def save_on_sale_house(self, house_data: Dict):
        """保存在售房源数据"""
        normalized_data = self._normalize_house_data(house_data)
        normalized_data['created_at'] = datetime.now()
        return self.collection_on_sale.insert_one(normalized_data)

    def save_sold_house(self, house_data: Dict):
        """保存成交房源数据"""
        normalized_data = self._normalize_house_data(house_data)
        normalized_data['created_at'] = datetime.now()
        return self.collection_sold.insert_one(normalized_data)

    def get_on_sale_houses(self, query: Dict = None, skip: int = 0, limit: int = 20) -> List[Dict]:
        """获取在售房源数据"""
        if query is None:
            query = {}
        if '小区名' in query:
            query['小区名'] = {'$regex': query['小区名'], '$options': 'i'}
        
        projection = {
            '户型图': 1,
            '小区名': 1,
            '户型': 1,
            '面积': 1,
            '总价': 1,
            '单价': 1,
            '楼层': 1,
            '建筑类型': 1,
            '挂牌时间': 1,
            '贝壳编号': 1,
            '房源链接': 1,
            '数据创建时间': 1,
            '_id': 1
        }
        
        houses = self.collection_on_sale.find(query, projection).skip(skip).limit(limit)
        return [{**house, '_id': str(house['_id'])} for house in houses]

    def get_sold_houses(self, query: Dict = None, skip: int = 0, limit: int = 20) -> List[Dict]:
        """获取成交房源数据"""
        try:
            logger.info(f"开始获取成交房源数据")
            if query is None:
                query = {}
            if '小区名' in query:
                query['小区名'] = query['小区名']
            
            logger.info(f"查询条件: {query}")
            
            # 使用与在售房源相同的查询方式
            houses = list(self.collection_sold.find(
                query,
                {
                    '_id': 0,
                    '小区名': 1,
                    '户型': 1,
                    '面积': 1,
                    '总价': 1,
                    '单价': 1,
                    '楼层信息': 1,
                    '成交时间': 1,
                    '挂牌价': 1,
                    '成交周期': 1,
                    '房源链接': 1,
                    '户型图': 1
                }
            ).skip(skip).limit(limit))
            
            logger.info(f"查询到 {len(houses)} 条记录")
            return houses
            
        except Exception as e:
            logger.error(f"获取成交房源数据失败: {str(e)}")
            logger.error(traceback.format_exc())
            raise  # 与在售房源一样，出错时抛出异常

    def get_floor_distribution(self, collection_name: str, community_name: str = None) -> Dict:
        """获取楼层分布统计
        Args:
            collection_name: 集合名称 ('ershoufang' 或 'chengjiao')
            community_name: 小区名称（可选）
        Returns:
            Dict: 楼层分布统计
        """
        collection = self.db[collection_name]
        match_stage = {'$match': {}} if community_name is None else {'$match': {'小区名': community_name}}
        
        pipeline = [
            match_stage,
            {
                '$group': {
                    '_id': '$楼层',
                    'count': {'$sum': 1}
                }
            },
            {
                '$sort': {'count': -1}
            }
        ]
        
        result = list(collection.aggregate(pipeline))
        return {item['_id']: item['count'] for item in result}

    def get_building_type_distribution(self, collection_name: str, community_name: str = None) -> Dict:
        """获取建筑类型分布统计
        Args:
            collection_name: 集合名称 ('ershoufang' 或 'chengjiao')
            community_name: 小区名称（可选）
        Returns:
            Dict: 建筑类型分布统计
        """
        collection = self.db[collection_name]
        match_stage = {'$match': {}} if community_name is None else {'$match': {'小区名': community_name}}
        
        pipeline = [
            match_stage,
            {
                '$group': {
                    '_id': '$建筑类型',
                    'count': {'$sum': 1}
                }
            },
            {
                '$sort': {'count': -1}
            }
        ]
        
        result = list(collection.aggregate(pipeline))
        return {item['_id']: item['count'] for item in result}
