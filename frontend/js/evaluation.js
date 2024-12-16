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
        }
    },
    methods: {
        async loadData() {
            try {
                const params = new URLSearchParams(window.location.search);
                const houseId = params.get('id');
                const communityName = params.get('community');
                
                if (!communityName) {
                    throw new Error('缺少必要参数');
                }

                // 获取在售房源数据
                const onSaleResponse = await axios.get('/api/houses/on-sale', {
                    params: {
                        community: communityName,
                        limit: 1000
                    }
                });
                console.log('在售房源数据:', onSaleResponse.data.data);
                this.onSaleHouses = onSaleResponse.data.data || [];

                // 获取成交房源数据
                const soldResponse = await axios.get('/api/houses/sold', {
                    params: {
                        community: communityName,
                        limit: 1000
                    }
                });
                console.log('成交房源数据:', soldResponse.data.data);
                this.soldHouses = soldResponse.data.data || [];

                // 如果有具体房源ID，获取该房源信息
                if (houseId) {
                    const house = this.onSaleHouses.find(h => h._id === houseId);
                    console.log('查找MongoDB ID:', houseId);
                    console.log('原始房源数据:', JSON.stringify(house, null, 2)); // 添加详细的数据日志
                    
                    if (house) {
                        // 处理户型图URL
                        let floorPlanImage = house.户型图;
                        if (floorPlanImage) {
                            floorPlanImage = floorPlanImage.split('?')[0];
                        }

                        // 处理建筑年代
                        let buildingYear = '';
                        if (house.建筑年代 !== undefined && house.建筑年代 !== null) {
                            buildingYear = typeof house.建筑年代 === 'number' 
                                ? house.建筑年代.toString() 
                                : house.建筑年代.toString().replace(/[年建]/g, '').trim();
                        }

                        // 处理朝向
                        let orientation = house.朝向;
                        if (orientation) {
                            orientation = orientation.toString().replace(/\n/g, '').trim();
                        }

                        // 处理梯户比
                        let elevatorRatio = house.梯户比;
                        if (elevatorRatio) {
                            elevatorRatio = elevatorRatio.toString().replace(/\n/g, '').trim();
                        }

                        // 处理区域和商圈
                        const district = house.区域?.toString().trim();
                        const area = house.商圈?.toString().trim();

                        // 处理上次交易和抵押信息
                        const lastDeal = house.上次交易?.toString().trim();
                        const mortgage = house.抵押信息?.toString().trim();

                        this.house = {
                            ...house,  // 保留原始数据
                            户型图: floorPlanImage,
                            区域: district || '暂无',
                            商圈: area || '暂无',
                            朝向: orientation || '暂无',
                            建筑年代: buildingYear || '暂无',
                            上次交易: lastDeal || '暂无记录',
                            抵押信息: mortgage || '暂无',
                            梯户比: elevatorRatio || '暂无'
                        };

                        // 打印处理前后的对比
                        console.log('原始数据中的关键字段:', {
                            区域: house.区域,
                            商圈: house.商圈,
                            朝向: house.朝向,
                            建筑年代: house.建筑年代,
                            上次交易: house.上次交易,
                            抵押信息: house.抵押信息
                        });
                        
                        console.log('处理后的数据:', this.house);
                    } else {
                        console.error('未找到对应房源，MongoDB ID:', houseId);
                    }
                }

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
                ElMessage.error('数据加载失败，请稍后重试');
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
                '1房': /^[一1]室/,
                '2房': /^[二2]室/,
                '3房': /^[三3]室/,
                '4房': /^[四4]室/,
                '其他': /./
            };

            this.historyHighs = Object.entries(houseTypes).map(([type, pattern]) => {
                // 筛选该户型的所有成交记录
                const typeHouses = this.soldHouses.filter(h => 
                    type === '其他' ? 
                    !Object.values(houseTypes).slice(0, -1).some(p => h.户型.match(p)) :
                    h.户型.match(pattern)
                );

                if (typeHouses.length === 0) return null;

                // 找出最高单价记录
                const maxPriceHouse = typeHouses.reduce((max, house) => 
                    parseFloat(house.单价) > parseFloat(max.单价) ? house : max
                );

                return {
                    户型: type,
                    最高单价: maxPriceHouse.单价,
                    成交套数: typeHouses.length,
                    成交时间: maxPriceHouse.成交时间
                };
            }).filter(Boolean);
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