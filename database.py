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
        try:
            # 成交房源唯一索引
            self.collection_sold.create_index([("房源ID", 1)], unique=True)
            
            # 其他索引
            self.collection_sold.create_index([("小区ID", 1)])
            self.collection_sold.create_index([("小区名", 1)])
            self.collection_sold.create_index([("成交时间", -1)])
            
            logger.info("索引创建/更新完成")
        except Exception as e:
            logger.error(f"创建索引时出错: {e}")

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
            if '城市' in query:  # 添加城市查询支持
                query['城市'] = query['城市']
            
            logger.info(f"查询条件: {query}")
            
            # 更新字段列表，与爬虫数据保持一致
            projection = {
                '_id': 0,
                '小区ID': 1,
                '房源ID': 1,
                '小区名': 1,
                '户型': 1,
                '面积': 1,
                '朝向': 1,
                '装修': 1,
                '楼层': 1,
                '总层数': 1,
                '建筑年代': 1,
                '楼栋结构': 1,
                '标签': 1,
                '位置': 1,
                '总价': 1,
                '单价': 1,
                '挂牌价': 1,
                '成交时间': 1,
                '成交周期': 1,
                '房源链接': 1,
                '户型图': 1,
                '城市': 1,  # 添加城市字段
                '数据创建时间': 1
            }
            
            houses = list(self.collection_sold.find(query, projection).skip(skip).limit(limit))
            logger.info(f"查询到 {len(houses)} 条记录")
            return houses
            
        except Exception as e:
            logger.error(f"获取成交房源数据失败: {str(e)}")
            logger.error(traceback.format_exc())
            raise

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

    def save_sold_houses_batch(self, houses: List[Dict]):
        """批量保存成交房源数据，对房源ID进行去重处理"""
        try:
            logger.info(f"开始批量保存成交房源数据，记录数: {len(houses)}")
            
            # 数据预处理
            processed_houses = []
            duplicate_count = 0
            
            # 获取已存在的房源ID列表
            existing_house_ids = set(self.collection_sold.distinct('房源ID'))
            logger.info(f"数据库中已存在 {len(existing_house_ids)} 个房源记录")
            
            for house in houses:
                try:
                    # 检查房源ID是否已存在
                    if house.get('房源ID') in existing_house_ids:
                        duplicate_count += 1
                        logger.info(f"房源ID {house.get('房源ID')} 已存在，跳过")
                        continue
                        
                    # 转换数值类型字段
                    numeric_fields = {
                        '总价': float,
                        '单价': float,
                        '面积': float,
                        '挂牌价': float,
                        '成交周期': int,
                        '总层数': int,
                        '建筑年代': int
                    }
                    
                    for field, convert_func in numeric_fields.items():
                        if field in house and house[field]:
                            try:
                                value = str(house[field]).strip()
                                value = value.replace('万', '').replace('元/平', '')
                                house[field] = convert_func(value)
                            except (ValueError, TypeError) as e:
                                logger.warning(f"字段 {field} 转换失败: {value}, 错误: {e}")
                                house[field] = None
                    
                    # 确保必要字段存在
                    required_fields = ['小区ID', '房源ID', '小区名']
                    if not all(field in house and house[field] for field in required_fields):
                        logger.warning(f"记录缺少必要字段: {house}")
                        continue
                    
                    # 确保所有字段都存在，没有的设为空值
                    all_fields = [
                        '小区ID', '房源ID', '小区名', '户型', '面积', '朝向', '装修',
                        '楼层', '总层数', '建筑年代', '楼栋结构', '标签', '位置',
                        '总价', '单价', '挂牌价', '成交时间', '成交周期', '房源链接',
                        '户型图', '城市', '数据创建时间'  # 添加城市字段
                    ]
                    
                    processed_house = {field: house.get(field, None) for field in all_fields}
                    processed_houses.append(processed_house)
                    
                except Exception as e:
                    logger.error(f"处理记录时出错: {e}")
                    logger.error(f"问题记录: {house}")
                    continue
            
            # 添加唯一索引（如果不存在）
            try:
                self.collection_sold.create_index([("房源ID", 1)], unique=True, sparse=True)
                # 添加城市字段的索引
                self.collection_sold.create_index([("城市", 1)])
            except Exception as e:
                logger.info(f"创建索引时出错（可能已存在）: {e}")
            
            if not processed_houses:
                logger.warning(f"没有新记录需要保存，{duplicate_count} 条重复记录被跳过")
                return None
            
            # 使用 ordered=False 允许部分插入成功
            try:
                result = self.collection_sold.insert_many(processed_houses, ordered=False)
                inserted_count = len(result.inserted_ids)
                logger.info(f"成功保存 {inserted_count} 条新记录，{duplicate_count} 条重复记录被跳过")
                return result
            except Exception as e:
                if "duplicate key error" in str(e):
                    # 获取实际插入成功的记录数
                    successful_inserts = len(processed_houses) - duplicate_count
                    logger.warning(f"部分记录插入成功: {successful_inserts} 条新记录，{duplicate_count} 条重复记录被跳过")
                    return e.details
                raise
            
        except Exception as e:
            logger.error(f"批量保存成交房源数据失败: {str(e)}")
            logger.error(traceback.format_exc())
            raise

    def save_on_sale_houses_batch(self, houses: List[Dict]):
        """批量保存在售房源数据，对房源ID进行去重处理"""
        try:
            logger.info(f"开始批量保存在售房源数据，记录数: {len(houses)}")
            
            # 数据预处理
            processed_houses = []
            duplicate_count = 0
            
            # 获取已存在的房源ID列表
            existing_house_ids = set(self.collection_on_sale.distinct('房源ID'))
            logger.info(f"数据库中已存在 {len(existing_house_ids)} 个房源记录")
            
            for house in houses:
                try:
                    # 检查房源ID是否已存在
                    if house.get('房源ID') in existing_house_ids:
                        duplicate_count += 1
                        logger.info(f"房源ID {house.get('房源ID')} 已存在，跳过")
                        continue
                        
                    # 转换数值类型字段
                    numeric_fields = {
                        '总价': float,
                        '单价': float,
                        '面积': float,
                        '建筑年代': int
                    }
                    
                    for field, convert_func in numeric_fields.items():
                        if field in house and house[field]:
                            try:
                                value = str(house[field]).strip()
                                value = value.replace('万', '').replace('元/平', '')
                                house[field] = convert_func(value)
                            except (ValueError, TypeError) as e:
                                logger.warning(f"字段 {field} 转换失败: {value}, 错误: {e}")
                                house[field] = None
                    
                    # 确保必要字段存在
                    required_fields = ['小区ID', '房源ID', '小区名']
                    if not all(field in house and house[field] for field in required_fields):
                        logger.warning(f"记录缺少必要字段: {house}")
                        continue
                    
                    # 确保所有字段都存在，没有的设为空值
                    all_fields = [
                        '小区ID',  # 确保小区ID在字段列表中
                        '房源ID', 
                        '小区名', 
                        '区域', 
                        '商圈', 
                        '户型', 
                        '面积', 
                        '楼层', 
                        '朝向', 
                        '梯户比', 
                        '总价', 
                        '单价', 
                        '挂牌时间', 
                        '上次交易', 
                        '抵押信息', 
                        '户型图', 
                        '贝壳编号', 
                        '房源链接', 
                        '城市', 
                        '建筑年代', 
                        '楼栋结构', 
                        '数据创建时间'
                    ]
                    
                    processed_house = {field: house.get(field, None) for field in all_fields}
                    processed_houses.append(processed_house)
                    
                except Exception as e:
                    logger.error(f"处理记录时出错: {e}")
                    logger.error(f"问题记录: {house}")
                    continue
            
            # 添加索引
            try:
                self.collection_on_sale.create_index([("房源ID", 1)], unique=True, sparse=True)
                self.collection_on_sale.create_index([("小区ID", 1)])  # 添加小区ID索引
            except Exception as e:
                logger.info(f"创建索引时出错（可能已存在）: {e}")
            
            if not processed_houses:
                logger.warning(f"没有新记录需要保存，{duplicate_count} 条重复记录被跳过")
                return None
            
            # 使用 ordered=False 允许部分插入成功
            try:
                result = self.collection_on_sale.insert_many(processed_houses, ordered=False)
                inserted_count = len(result.inserted_ids)
                logger.info(f"成功保存 {inserted_count} 条新记录，{duplicate_count} 条重复记录被跳过")
                return result
            except Exception as e:
                if "duplicate key error" in str(e):
                    successful_inserts = len(processed_houses) - duplicate_count
                    logger.warning(f"部分记录插入成功: {successful_inserts} 条新记录，{duplicate_count} 条重复记录被跳过")
                    return e.details
                raise
            
        except Exception as e:
            logger.error(f"批量保存在售房源数据失败: {str(e)}")
            logger.error(traceback.format_exc())
            raise
