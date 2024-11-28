from playwright.sync_api import sync_playwright
import time
import json
import logging
import random
import re
from time import sleep
from functools import wraps
from typing import Dict, List, Tuple
from pymongo import MongoClient
from urllib.parse import quote_plus
from datetime import datetime
from dotenv import load_dotenv
import os

# 加载.env文件
load_dotenv()

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def random_sleep(min_seconds=2, max_seconds=5):
    """随机等待一段时间"""
    time = random.uniform(min_seconds, max_seconds)
    logging.info(f"等待 {time:.2f} 秒...")
    sleep(time)

def retry_on_error(max_retries=3, delay=2):
    """错误重试装饰器"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_retries - 1:  # 最后一次尝试
                        logging.error(f"重试{max_retries}次后仍然失败: {str(e)}")
                        raise
                    logging.warning(f"第{attempt + 1}次尝试失败: {str(e)}")
                    sleep(delay * (attempt + 1))  # 递增等待时间
            return None
        return wrapper
    return decorator

class BeikeSpider:
    def __init__(self):
        self.playwright = sync_playwright().start()
        self.browser = self.playwright.chromium.launch(headless=False)
        self.context = self.browser.new_context()
        self.page = self.context.new_page()
        self.cookies = None
        
        # 尝试加载已保存的cookies
        self.load_cookies()

        # 连接MongoDB
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
            
            # 直接使用targethouse数据库
            self.db = self.client.targethouse
            
            # 创建或获取集合
            self.ershoufang_collection = self.db.ershoufang
            self.chengjiao_collection = self.db.chengjiao
            
            # 简单的连接测试
            self.db.command('ping')
            
            logging.info("数据库连接成功")
        except Exception as e:
            logging.error(f"数据库连接失败: {e}")
            raise

    def load_cookies(self):
        """加载cookies"""
        try:
            with open('cookies.json', 'r') as f:
                self.cookies = json.load(f)
                self.context.add_cookies(self.cookies)
                logging.info("已加载保存的cookies")
                return True
        except Exception as e:
            logging.error(f"加载cookies失败: {str(e)}")
            return False

    def _check_login(self):
        """检查是否处于登录状态"""
        try:
            self.page.goto("https://sh.ke.com/chengjiao/")
            self.page.wait_for_load_state("networkidle")
            
            login_button = self.page.query_selector(".btn-login")
            if login_button:
                logging.warning("未检测到登录状态，请先登录")
                return False
            
            logging.info("已检测到登录状态")
            return True
        except Exception as e:
            logging.error(f"登录状态检查失败: {e}")
            raise

    def login(self):
        """登录并保存cookies"""
        # 先检查是否已经登录
        try:
            self.page.goto("https://sh.ke.com/chengjiao/")
            self.page.wait_for_load_state("networkidle")
            
            # 检查是否存在登录按钮
            login_button = self.page.query_selector(".btn-login")
            if not login_button:
                logging.info("检测到已经登录")
                return True
        except Exception as e:
            logging.error(f"检查登录状态时出错: {e}")
        
        # 如果未登录，则进行登录操作
        login_url = "https://clogin.ke.com/login?service=https%3A%2F%2Fwww.ke.com%2Fuser%2Fchecklogin%3Fredirect%3Dhttps%253A%252F%252Fsh.ke.com%252Fchengjiao%252F"
        self.page.goto(login_url)
        print("\n请在浏览器中完成登录操作...")
        print("1. 输入手机号")
        print("2. 获取并输入验证码")
        print("3. 点击登录按钮")
        print("\n等待登录完成...\n")
        
        try:
            # 等待重定向到成交页面
            self.page.wait_for_url("**/chengjiao/**", timeout=300000)  # 5分钟超时
            print("检测到登录成功！")
            
            # 等待页面完全加载
            self.page.wait_for_load_state("networkidle")
            
            # 验证是否真的登录成功
            current_url = self.page.url
            if "chengjiao" not in current_url:
                raise Exception("登录失败，当前页面不是目标页面")
            
            # 保存cookies
            self.cookies = self.context.cookies()
            with open('cookies.json', 'w') as f:
                json.dump(self.cookies, f)
            print("Cookies已保存")
            return True
            
        except Exception as e:
            print(f"登录过程中出现错误: {e}")
            raise

    @retry_on_error()
    def get_ershoufang_info(self, community_name: str) -> List[Dict]:
        """获取在售房源信息"""
        if not self._check_login():
            raise Exception("请先登录后再进行操作")
        
        results = []
        try:
            # 打开在售房源列表页
            self.page.goto("https://sh.ke.com/ershoufang/")
            random_sleep(4, 8)
            
            # 搜索小区
            self.page.fill("#searchInput", community_name)
            self.page.click("#searchForm > div > button")
            random_sleep(3, 5)
            
            # 用于存储所有房源链接
            all_house_links = []
            
            # 获取总页数和当前页数
            page_box = self.page.query_selector("#beike > div.sellListPage > div.content > div.leftContent > div.contentBottom.clear > div.page-box.fr > div")
            if page_box:
                page_data = json.loads(page_box.get_attribute("page-data"))
                total_pages = page_data.get("totalPage", 1)
                current_page = page_data.get("curPage", 1)
                page_url_template = page_box.get_attribute("page-url")
                
                logging.info(f"找到总页数: {total_pages}")
                
                # 遍历所有页面
                for page in range(current_page, total_pages + 1):
                    if page > 1:
                        # 构造下一页的URL
                        next_url = f"https://sh.ke.com{page_url_template.replace('{page}', str(page))}"
                        self.page.goto(next_url)
                        random_sleep(2, 4)
                    
                    # 获取当前页面的房源链接
                    house_links = self.page.eval_on_selector_all(
                        "#beike > div.sellListPage > div.content > div.leftContent > div:nth-child(4) > ul > li > div > div.title > a",
                        "elements => elements.map(el => el.href)"
                    )
                    
                    all_house_links.extend(house_links)
                    logging.info(f"第{page}页，获取到 {len(house_links)} 套房源")
            else:
                # 如果没有找到页码信息，就只处理当前页
                house_links = self.page.eval_on_selector_all(
                    "#beike > div.sellListPage > div.content > div.leftContent > div:nth-child(4) > ul > li > div > div.title > a",
                    "elements => elements.map(el => el.href)"
                )
                all_house_links.extend(house_links)
            
            logging.info(f"总共找到 {len(all_house_links)} 套在售房源")
            
            for link in all_house_links:
                try:
                    self.page.goto(link)
                    random_sleep(2, 4)
                    
                    # 获取区域和商圈信息
                    district = (self.page.query_selector("#beike > div.sellDetailPage > div:nth-child(6) > div.overview > div.content > div.aroundInfo > div.areaName > span.info > a:nth-child(1)").text_content() or "").strip()
                    business_area = (self.page.query_selector("#beike > div.sellDetailPage > div:nth-child(6) > div.overview > div.content > div.aroundInfo > div.areaName > span.info > a:nth-child(2)").text_content() or "").strip()
                    
                    # 获取梯户比
                    elevator_ratio = (self.page.query_selector("#introduction > div > div > div.base > div.content > ul > li:nth-child(11)").text_content() or "").strip()
                    elevator_ratio = elevator_ratio.replace("梯户比例", "").strip()
                    
                    # 处理挂牌时间
                    list_time = (self.page.query_selector("#introduction > div > div > div.transaction > div.content > ul > li:nth-child(1)").text_content() or "").strip()
                    list_time = list_time.replace("挂牌时间", "").strip()
                    
                    # 处理上次交易时间
                    last_deal = (self.page.query_selector("#introduction > div > div > div.transaction > div.content > ul > li:nth-child(3)").text_content() or "").strip()
                    last_deal = last_deal.replace("上次交易", "").strip()
                    
                    # 获取户型图链接
                    layout_selector = "#layout > div.layout > div.content > div.imgdiv > img"
                    layout_element = self.page.query_selector(layout_selector)
                    layout_image = layout_element.get_attribute("src") if layout_element else ""
                    
                    # 获取贝壳编号并只保留数字
                    beike_id = (self.page.text_content("#beike > div.sellDetailPage > div:nth-child(6) > div.overview > div.content > div.aroundInfo > div.houseRecord > span.info") or "").strip()
                    beike_id = ''.join(filter(str.isdigit, beike_id))  # 只保留数字
                    
                    # 处理户型信息
                    huxing = (self.page.text_content("#introduction > div > div > div.base > div.content > ul > li:nth-child(1)") or "").strip()
                    huxing = huxing.replace("房屋户型", "").strip()  # 移除"房屋户型"文字
                    
                    # 处理面积信息
                    area = (self.page.text_content("#introduction > div > div > div.base > div.content > ul > li:nth-child(2)") or "").strip()
                    area = area.replace("建筑面积", "").strip()  # 移除"建筑面积"文字
                    area = area.replace("㎡", "").strip()  # 移除"㎡"符号
                    
                    # 处理楼层信息
                    floor = (self.page.text_content("#introduction > div > div > div.base > div.content > ul > li:nth-child(5)") or "").strip()
                    floor = floor.replace("所在楼层", "").strip()  # 移除"所在楼层"文字
                    floor = floor.split("咨询楼层")[0].strip()  # 移除"咨询楼层"及之后的内容
                    
                    info = {
                        "小区名": (self.page.text_content("div.communityName > a.info") or "").strip().replace('\n', ''),
                        "区域": district,
                        "商圈": business_area,
                        "户型": huxing,
                        "面积": area,
                        "总价": (self.page.text_content("span.total") or "").strip(),
                        "单价": (self.page.text_content("div.unitPrice > span") or "").strip(),
                        "朝向": (self.page.text_content("div.mainInfo") or "").strip(),
                        "楼层": floor,
                        "梯户比": elevator_ratio,
                        "挂牌时间": list_time,
                        "上次交易": last_deal,
                        "抵押信息": (self.page.text_content("#introduction > div > div > div.transaction > div.content > ul > li:nth-child(7)") or "").strip(),
                        "户型图": layout_image,
                        "贝壳编号": beike_id,
                        "房源链接": link,
                        "数据创建时间": datetime.now()
                    }
                    
                    # 存入数据库
                    try:
                        self.ershoufang_collection.insert_one(info)
                        logging.info(f"成功保存房源信息: {info['小区名']} - 贝壳编号: {info['贝壳编号']}")
                    except Exception as e:
                        logging.error(f"保存到数据库失败: {e}")
                    
                    results.append(info)
                    random_sleep(3, 6)
                    
                except Exception as e:
                    logging.error(f"处理房源链接时出错: {e}")
                    continue
                    
            return results
            
        except Exception as e:
            logging.error(f"获取在售房源信息时出错: {e}")
            raise

    @retry_on_error()
    def get_chengjiao_info(self, community_name: str) -> List[Dict]:
        """获取成交房源信息"""
        if not self._check_login():
            raise Exception("请先登录后再进行操作")
        
        results = []
        try:
            # 访问第一页
            self.page.goto("https://sh.ke.com/chengjiao/")
            self.page.fill("#searchInput", community_name)
            self.page.click("#searchForm > div > button")
            random_sleep(2, 4)  # 仅在搜索后等待页面加载
            
            while True:  # 循环处理每一页
                # 等待列表加载完成
                self.page.wait_for_selector(".listContent > li", timeout=10000)
                
                # 获取当前页的房源列表
                items = self.page.query_selector_all(".listContent > li")
                logging.info(f"当前页找到 {len(items)} 条成交记录")
                
                for item in items:
                    try:
                        # 获取标题信息
                        title_element = item.query_selector(".title > a")
                        title_text = title_element.text_content().strip()
                        detail_link = title_element.get_attribute("href")
                        title_parts = title_text.split(' ')
                        
                        # 分解标题信息
                        community = title_parts[0] if title_parts else ""
                        house_type = title_parts[1] if len(title_parts) > 1 else ""
                        area = title_parts[2] if len(title_parts) > 2 else ""
                        area = area.replace("平米", "").strip() if area else ""
                        
                        # 处理楼层信息 - 只保留"中楼层(共6层)"部分
                        floor_info = item.query_selector(".positionInfo").text_content().strip()
                        floor_info = floor_info.split(' ')[0] if ' ' in floor_info else floor_info

                        # 获取户型图
                        img_selector = "#beike > div.dealListPage > div.content > div.leftContent > div:nth-child(4) > ul > li:nth-child(1) > a > img"
                        img_element = item.query_selector(img_selector)
                        layout_image = img_element.get_attribute("src") if img_element else ""

                        # 获取列表页的基本信息
                        info = {
                            "小区名": community,
                            "户型": house_type,
                            "面积": area,
                            "总价": item.query_selector(".totalPrice > span").text_content().strip(),
                            "单价": item.query_selector(".unitPrice > span").text_content().strip(),
                            "成交时间": item.query_selector(".dealDate").text_content().strip(),
                            "楼层信息": floor_info,
                            "挂牌价": item.query_selector(".dealCycleTxt > span:nth-child(1)").text_content().strip(),
                            "成交周期": item.query_selector(".dealCycleTxt > span:nth-child(2)").text_content().strip(),
                            "房源链接": detail_link,
                            "户型图": layout_image,
                            "数据创建时间": datetime.now()
                        }

                        # 直接保存到数据库
                        try:
                            self.chengjiao_collection.insert_one(info)
                            logging.info(f"成功保存成交房源信息: {info['小区名']} - {info['总价']}万")
                        except Exception as e:
                            logging.error(f"保存到数据库失败: {e}")
                        
                        results.append(info)
                        
                    except Exception as e:
                        logging.error(f"处理成交房源时出错: {e}")
                        continue
                
                # 检查是否有下一页
                page_box = self.page.query_selector(".page-box.house-lst-page-box")
                if not page_box:
                    break
                
                # 获取页面数据
                page_data = json.loads(page_box.get_attribute("page-data"))
                current_page = page_data.get("curPage", 1)
                total_pages = page_data.get("totalPage", 1)
                
                logging.info(f"当前第 {current_page} 页，共 {total_pages} 页")
                
                if current_page >= total_pages:
                    break
                
                # 构造下一页URL并访问
                next_page = current_page + 1
                next_url = f"https://sh.ke.com/chengjiao/pg{next_page}rs{community_name}"
                self.page.goto(next_url)
                random_sleep(2, 4)  # 页面切换后等待加载
                
            logging.info(f"成功保存 {len(results)} 条成交记录")
            return results
            
        except Exception as e:
            logging.error(f"获取成交房源信息时出错: {e}")
            raise

    def close(self):
        """关闭浏览器和数据库连接"""
        try:
            self.context.close()
            self.browser.close()
            self.playwright.stop()
            self.client.close()
            logging.info("成功关闭所有连接")
        except Exception as e:
            logging.error(f"关闭连接时出错: {e}")

def main():
    spider = BeikeSpider()
    try:
        # 检查是否需要登录
        if not spider._check_login():
            print("开始登录贝壳找房...")
            spider.login()
        else:
            print("使用已保存的登录状态")
        
        community_name = "新梅共和城"
        print(f"\n开始爬取{community_name}的在售房源...")
        ershoufang_info = spider.get_ershoufang_info(community_name)
        
        print(f"\n开始爬取{community_name}的成交房源...")
        chengjiao_info = spider.get_chengjiao_info(community_name)
        
    except Exception as e:
        print(f"程序执行出错: {e}")
    finally:
        print("\n正在关闭浏览器...")
        spider.close()
        print("程序执行完毕！")

if __name__ == "__main__":
    main()
