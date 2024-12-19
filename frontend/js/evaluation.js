const { createApp } = Vue;

const app = createApp({
    data() {
        return {
            house: null,
            onSaleHouses: [],
            soldHouses: [],
            communityStats: {
                onSaleCount: 0,
                onSaleAvgPrice: 0,
                recentSoldCount: 0,
                recentSoldAvgPrice: 0
            },
            historyHighs: [],
            priceChart: null,
            priceDistChart: null,
            loading: true
        }
    },
    computed: {
        sortedOnSaleHouses() {
            return [...this.onSaleHouses].sort((a, b) => {
                // 户型排序函数
                const getHouseTypeOrder = (type) => {
                    if (!type) return 999;
                    if (type.match(/^([一1])[室房]/)) return 1;
                    if (type.match(/^([二2])[室房]/)) return 2;
                    if (type.match(/^([三3])[室房]/)) return 3;
                    if (type.match(/^([四4])[室房]/)) return 4;
                    return 999; // 其他户型
                };

                // 先按户型排序
                const typeOrderA = getHouseTypeOrder(a.户型);
                const typeOrderB = getHouseTypeOrder(b.户型);
                
                if (typeOrderA !== typeOrderB) {
                    return typeOrderA - typeOrderB;
                }
                
                // 户型相同时按单价升序
                return parseFloat(a.单价 || 0) - parseFloat(b.单价 || 0);
            });
        },
        
        sortedSoldHouses() {
            return [...this.soldHouses]
                // 按成交时间降序排序
                .sort((a, b) => new Date(b.成交时间) - new Date(a.成交时间))
                // 只取前60条记录
                .slice(0, 60)
                // 处理楼层显示格式
                .map(house => ({
                    ...house,
                    楼层: house.总层数 ? `${house.楼层}/共${house.总层数}层` : house.楼层
                }));
        },

        onSaleDistribution() {
            console.log('开始统计在售房源分布...');
            console.log('当前在售房源总数:', this.onSaleHouses?.length || 0);

            // 按户型分类统计
            const houseTypes = {
                '一室': {
                    pattern: /^[一1]室/,
                    order: 1,
                    display: '1房'
                },
                '两室': {
                    pattern: /^[两二2]室/,
                    order: 2,
                    display: '2房'
                },
                '三室': {
                    pattern: /^[三3]室/,
                    order: 3,
                    display: '3房'
                },
                '四室': {
                    pattern: /^[四4]室/,
                    order: 4,
                    display: '4房'
                }
            };

            // 按户型分组并统计
            const distribution = {};

            // 初始化所有户型的统计数据
            Object.entries(houseTypes).forEach(([type, info]) => {
                distribution[type] = {
                    户型: info.display,
                    count: 0,
                    最低挂牌单价: Infinity,
                    最低单价上架时间: '',
                    order: info.order
                };
            });

            // 添加"其他"类型
            distribution['其他'] = {
                户型: '其他',
                count: 0,
                最低挂牌单价: Infinity,
                最低单价上架时间: '',
                order: 5
            };

            // 统计每个房源
            if (this.onSaleHouses && this.onSaleHouses.length > 0) {
                this.onSaleHouses.forEach(house => {
                    console.log('处理房源:', {
                        户型: house.户型,
                        单价: house.单价,
                        挂牌时间: house.挂牌时间
                    });

                    let matched = false;
                    for (const [type, info] of Object.entries(houseTypes)) {
                        if (house.户型 && house.户型.match(info.pattern)) {
                            distribution[type].count += 1;
                            console.log(`匹配到户型 ${type}(${info.display}), 当前数量: ${distribution[type].count}`);
                            
                            const price = parseFloat(house.单价);
                            if (price && price < distribution[type].最低挂牌单价) {
                                distribution[type].最低挂牌单价 = price;
                                distribution[type].最低单价上架时间 = house.挂牌时间 || '';
                            }
                            matched = true;
                            break;
                        }
                    }
                    
                    if (!matched) {
                        distribution['其他'].count += 1;
                        console.log(`未匹配到具体户型，归类为"其他", 当前数量: ${distribution['其他'].count}`);
                        
                        const price = parseFloat(house.单价);
                        if (price && price < distribution['其他'].最低挂牌单价) {
                            distribution['其他'].最低挂牌单价 = price;
                            distribution['其他'].最低单价上架时间 = house.挂牌时间 || '';
                        }
                    }
                });
            }

            // 输出最终统计结果
            console.log('在售房源分布统计结果:', Object.entries(distribution).map(([type, data]) => ({
                户型: data.户型,
                在售套数: data.count,
                最低挂牌单价: data.最低挂牌单价 === Infinity ? '-' : Math.round(data.最低挂牌单价).toLocaleString(),
                最低单价上架时间: this.formatDate(data.最低单价上架时间)
            })));

            // 转换为数组并排序
            const result = Object.values(distribution)
                .sort((a, b) => a.order - b.order)
                .map(item => ({
                    户型: item.户型,
                    在售套数: item.count,
                    最低挂牌单价: item.最低挂牌单价 === Infinity ? '-' : Math.round(item.最低挂牌单价).toLocaleString(),
                    最低单价上架时间: this.formatDate(item.最低单价上架时间)
                }));

            console.log('最终返回的分布数据:', result);  // 添加这行调试输出
            return result;
        }
    },
    methods: {
        // 格式化户型显示
        formatHouseType(type) {
            const typeMap = {
                '一室': '1房',
                '两室': '2房',
                '三室': '3房',
                '四室': '4房',
                '其他': '其他'
            };
            return typeMap[type] || type;
        },

        // 统一日期格式化
        formatDate(dateStr) {
            if (!dateStr) return '-';
            try {
                // 处理多种可能的日期格式
                let date;
                if (dateStr.includes('年')) {
                    // 处理 "YYYY年MM月DD日" 格式
                    const parts = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
                    if (parts) {
                        date = new Date(parts[1], parts[2] - 1, parts[3]);
                    }
                } else {
                    date = new Date(dateStr);
                }

                if (isNaN(date.getTime())) return dateStr;

                return date.getFullYear() + '.' + 
                       String(date.getMonth() + 1).padStart(2, '0') + '.' +
                       String(date.getDate()).padStart(2, '0');
            } catch (e) {
                console.error('日期格式化错误:', e);
                return dateStr;
            }
        },

        async loadData() {
            try {
                const params = new URLSearchParams(window.location.search);
                const houseId = params.get('id');
                
                if (!houseId) {
                    throw new Error('缺少必要参数');
                }

                // 先获取指定id的房源信息
                const houseResponse = await axios.get(`/api/houses/detail/${houseId}`);
                if (!houseResponse.data || !houseResponse.data.data) {
                    throw new Error('未找到房源信息');
                }
                
                this.house = houseResponse.data.data;
                const communityId = this.house.小区ID;  // 使用小区ID

                // 使用小区ID获取在售房源数据
                const onSaleResponse = await axios.get(`/api/houses/community/${communityId}`, {
                    params: {
                        type: 'on-sale'
                    }
                });
                this.onSaleHouses = onSaleResponse.data.data || [];

                // 获取成交房源数据
                const soldResponse = await axios.get(`/api/houses/community/${communityId}`, {
                    params: {
                        type: 'sold'
                    }
                });
                this.soldHouses = (soldResponse.data.data || []).map(house => {
                    // 构建房源链接
                    let houseLink = '';
                    // 优先使用原有链接
                    if (house.房源链接) {
                        houseLink = house.房源链接;
                    } 
                    // 如果有房源ID，构建链接
                    else if (house.房源ID) {
                        const cityDomain = {
                            '上海': 'sh',
                            '北京': 'bj',
                            '广州': 'gz',
                            '深圳': 'sz'
                        }[house.城市 || '上海'] || 'sh';
                        
                        houseLink = `https://${cityDomain}.ke.com/chengjiao/${house.房源ID}.html`;
                    }
                    // 如果有贝壳编号，也可以构建链接
                    else if (house.贝壳编号) {
                        const cityDomain = {
                            '上海': 'sh',
                            '北京': 'bj',
                            '广州': 'gz',
                            '深圳': 'sz'
                        }[house.城市 || '上海'] || 'sh';
                        
                        houseLink = `https://${cityDomain}.ke.com/chengjiao/${house.贝壳编号}.html`;
                    }

                    return {
                        ...house,
                        房源链接: houseLink  // 直接在加载数据时设置房源链接
                    };
                });

                // 强制更新视图
                this.$nextTick(() => {
                    console.log('视图已更新，当前在售房源分布:', this.onSaleDistribution);
                });

                // 计算小区统计信息
                await this.calculateCommunityStats();
                
                // 计算历史高点
                await this.calculateHistoryHighs();

                // 使用nextTick确保DOM更新后再绘制图表
                this.$nextTick(() => {
                    this.drawPriceChart();
                    this.drawPriceDistChart();
                });

            } catch (error) {
                console.error('加载数据失败:', error);
                alert(error.response?.data?.message || error.message || '数据加载失败，请稍后重试');
            } finally {
                this.loading = false;
            }
        },

        calculateCommunityStats() {
            try {
                // 计算在售统计
                this.communityStats.onSaleCount = this.onSaleHouses.length || 0;
                
                // 计算在售均价
                const validOnSalePrices = this.onSaleHouses
                    .filter(h => h.单价 && !isNaN(parseFloat(h.单价)))
                    .map(h => parseFloat(h.单价));
                    
                this.communityStats.onSaleAvgPrice = validOnSalePrices.length > 0
                    ? Math.round(validOnSalePrices.reduce((sum, price) => sum + price, 0) / validOnSalePrices.length)
                    : 0;

                // 计算近3个月成交统计
                const threeMonthsAgo = new Date();
                threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                
                // 过滤并验证成交时间和单价
                const recentSoldHouses = this.soldHouses.filter(house => {
                    if (!house.成交时间) return false;
                    
                    try {
                        const dealDate = new Date(house.成交时间.replace(/\./g, '-')); // 处理日期格式
                        if (isNaN(dealDate.getTime())) return false;
                        
                        return dealDate >= threeMonthsAgo;
                    } catch {
                        return false;
                    }
                });

                this.communityStats.recentSoldCount = recentSoldHouses.length || 0;
                
                // 计算成交均价
                const validSoldPrices = recentSoldHouses
                    .filter(h => h.单价 && !isNaN(parseFloat(h.单价)))
                    .map(h => parseFloat(h.单价));
                    
                this.communityStats.recentSoldAvgPrice = validSoldPrices.length > 0
                    ? Math.round(validSoldPrices.reduce((sum, price) => sum + price, 0) / validSoldPrices.length)
                    : 0;

                // 打印调试信息
                console.log('统计计算结果:', {
                    onSaleCount: this.communityStats.onSaleCount,
                    onSaleAvgPrice: this.communityStats.onSaleAvgPrice,
                    recentSoldCount: this.communityStats.recentSoldCount,
                    recentSoldAvgPrice: this.communityStats.recentSoldAvgPrice,
                    validOnSalePrices: validOnSalePrices.length,
                    validSoldPrices: validSoldPrices.length,
                    recentSoldHouses: recentSoldHouses.length
                });

            } catch (error) {
                console.error('计算统计信息时出错:', error);
                // 设置默认值
                this.communityStats = {
                    onSaleCount: 0,
                    onSaleAvgPrice: 0,
                    recentSoldCount: 0,
                    recentSoldAvgPrice: 0
                };
            }
        },

        calculateHistoryHighs() {
            // 按户型分类统计
            const houseTypes = {
                '1房': {
                    pattern: /^[一1]室/,
                    order: 1
                },
                '2房': {
                    pattern: /^[两二2]室/,
                    order: 2
                },
                '3房': {
                    pattern: /^[三3]室/,
                    order: 3
                },
                '4房': {
                    pattern: /^[四4]室/,
                    order: 4
                },
                '其他': {
                    pattern: /./,
                    order: 5
                }
            };

            const stats = {};
            
            // 初始化统计对象
            Object.keys(houseTypes).forEach(type => {
                stats[type] = {
                    户型: type,
                    成交套数: 0,
                    最高单价: 0,
                    成交时间: '',
                    order: houseTypes[type].order
                };
            });

            // 统计每个房源
            this.soldHouses.forEach(house => {
                let matched = false;
                for (const [type, info] of Object.entries(houseTypes)) {
                    if (type === '其他') continue;
                    if (house.户型?.match(info.pattern)) {
                        stats[type].成交套数++;
                        const price = parseFloat(house.单价);
                        if (price > stats[type].最高单价) {
                            stats[type].最高单价 = price;
                            stats[type].成交时间 = house.成交时间;
                        }
                        matched = true;
                        break;
                    }
                }
                
                if (!matched) {
                    stats['其他'].成交套数++;
                    const price = parseFloat(house.单价);
                    if (price > stats['其他'].最高单价) {
                        stats['其他'].最高单价 = price;
                        stats['其他'].成交时间 = house.成交时间;
                    }
                }
            });

            // 转换为数组并排序
            this.historyHighs = Object.values(stats)
                .sort((a, b) => a.order - b.order)
                .map(item => ({
                    户型: item.户型,
                    成交套数: item.成交套数 || 0,  // 确保显示0
                    最高单价: item.最高单价 ? Math.round(item.最高单价).toLocaleString() : '-',
                    成交时间: this.formatDate(item.成交时间)
                }));
        },

        drawPriceChart() {
            if (!this.soldHouses.length) return;

            // 过滤掉非标准户型的房源
            const validHouses = this.soldHouses.filter(house => {
                const houseType = house.户型?.trim() || '';
                return /^[一二三四五1234567]室/.test(houseType);
            });

            // 按成交时间排序
            const sortedHouses = validHouses.sort((a, b) => {
                return new Date(a.成交时间) - new Date(b.成交时间);
            });

            const chartData = {
                labels: sortedHouses.map(h => h.成交时间),
                datasets: [{
                    label: '成交单价',
                    data: sortedHouses.map(h => h.单价),
                    borderColor: '#ff5757',
                    backgroundColor: 'rgba(255, 87, 87, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            };

            const canvas = document.getElementById('priceChart');
            if (!canvas) return;

            if (this.priceChart) {
                this.priceChart.destroy();
            }

            this.priceChart = new Chart(canvas, {
                type: 'line',
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: '成交单价趋势'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: false,
                            title: {
                                display: true,
                                text: '单价(元/㎡)'
                            }
                        }
                    }
                }
            });
        },

        drawPriceDistChart() {
            const canvas = document.getElementById('priceDistChart');
            if (!canvas) return;

            // 计算价格区间
            const prices = this.onSaleHouses.map(h => parseFloat(h.单价));
            const minPrice = Math.floor(Math.min(...prices) / 1000) * 1000;
            const maxPrice = Math.ceil(Math.max(...prices) / 1000) * 1000;
            
            // 创建价格区间
            const intervals = [];
            for (let price = minPrice; price <= maxPrice; price += 1000) {
                intervals.push({
                    min: price,
                    max: price + 1000,
                    count: 0
                });
            }

            // 统计每个区间的房源数量
            prices.forEach(price => {
                const interval = intervals.find(i => price >= i.min && price < i.max);
                if (interval) interval.count++;
            });

            const data = {
                labels: intervals.map(i => `${i.min/1000}k-${i.max/1000}k`),
                datasets: [{
                    label: '房源数量',
                    data: intervals.map(i => i.count),
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    borderColor: 'rgb(75, 192, 192)',
                    borderWidth: 1
                }]
            };

            if (this.priceDistChart) {
                this.priceDistChart.destroy();
            }

            this.priceDistChart = new Chart(canvas, {
                type: 'bar',
                data: data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: '房源数量'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: '单价区间'
                            }
                        }
                    }
                }
            });
        },

        handleImageError(event) {
            const img = event.target;
            console.log('图片加载失败:', img.src);
            
            // 如果不是默认图片，尝试不同的加载策略
            if (!img.src.includes('default-house.png')) {
                const originalSrc = img.src;
                
                // 移除现有的事件处理器
                img.onerror = null;
                
                // 设置新的错误处理器
                img.onerror = () => {
                    console.log('备选加载也失败，使用默认图片');
                    img.src = 'static/default-house.png';
                    img.onerror = null;
                };
                
                // 尝试使用原始URL加载
                if (originalSrc.includes('?')) {
                    img.src = originalSrc.split('?')[0];
                } else {
                    img.src = 'static/default-house.png';
                }
            }
        }
    },
    mounted() {
        this.loadData();
    }
});

app.mount('#evaluationApp'); 