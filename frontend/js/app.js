const { createApp } = Vue;
const { ElMessage } = ElementPlus;

const API_BASE_URL = '/api';  // 直接使用相对路径，让浏览器自动匹配当前协议和域名

// 修改axios请求配置
const axiosConfig = {
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
        'X-Requested-With': 'XMLHttpRequest'
    }
};

// 创建axios实例
const axiosInstance = axios.create(axiosConfig);

// 添加到 createApp 之前
const vIntersection = {
    mounted: (el, binding) => {
        if (typeof binding.value === 'function') {
            binding.value(el);
        }
    }
};

// 创建Vue应用实例
const app = createApp({
    data() {
        return {
            searchQuery: '',
            selectedCity: '上海',
            selectedHouseType: '',
            selectedFloorLevel: '',
            onSaleHouses: [],
            soldHouses: [],
            filteredOnSaleHouses: null,  
            filteredSoldHouses: null,    
            loading: false,
            error: null,
            charts: {
                onSaleType: null,
                onSaleFloor: null,
                soldType: null,
                soldFloor: null
            },
            soldSortField: null,
            soldSortOrder: 'asc',
            onSaleSortField: '',
            onSaleSortOrder: 'asc',
            selectedType: '',
            selectedFloor: '',
            imageCache: new Map(),
            loadedImages: new Set(),
            imageLoadErrors: new Set(),
            imageObserver: null,
            observedImages: new Set(),
            defaultHouseImage: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjkwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iOTAiIGZpbGw9IiNmNWY1ZjUiLz48cGF0aCBkPSJNNjAgMjBMODUgNjBIMzVMNjAgMjB6IiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNjAiIHk9IjcwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM4ODgiPuaXoOaIv+WbvjwvdGV4dD48L3N2Zz4=',
            placeholderImage: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjkwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iOTAiIGZpbGw9IiNmNWY1ZjUiLz48dGV4dCB4PSI2MCIgeT0iNDUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzg4OCI+5Yqg6L295LitLi4uPC90ZXh0Pjwvc3ZnPg=='
        }
    },
    computed: {
        displayOnSaleHouses() {
            // 获取基础数据
            let houses = this.filteredOnSaleHouses || this.onSaleHouses;
            
            // 应用排序
            if (this.onSaleSortField) {
                houses = [...houses].sort((a, b) => {
                    try {
                        const aValue = a[this.onSaleSortField];
                        const bValue = b[this.onSaleSortField];
                        
                        if (!aValue || !bValue) return 0;
                        
                        const aNum = parseFloat(aValue.toString().replace(/[^\d.]/g, '')) || 0;
                        const bNum = parseFloat(bValue.toString().replace(/[^\d.]/g, '')) || 0;
                        
                        return this.onSaleSortOrder === 'asc' ? aNum - bNum : bNum - aNum;
                    } catch (error) {
                        console.error('排序出错:', error);
                        return 0;
                    }
                });
            }
            
            return houses;
        },
        displaySoldHouses() {
            // 获取基础数据
            let houses = this.soldHouses;
            
            // 去重处理
            const uniqueMap = new Map();
            houses = houses.filter(house => {
                const key = `${house.小区名}-${house.成交时间}-${house.面积}-${house.总价}`;
                if (!uniqueMap.has(key)) {
                    uniqueMap.set(key, true);
                    return true;
                }
                return false;
            });
            
            // 应用排序
            if (this.soldSortField) {
                houses = houses.sort((a, b) => {
                    try {
                        const aValue = a[this.soldSortField];
                        const bValue = b[this.soldSortField];
                        
                        if (!aValue || !bValue) return 0;
                        
                        const aNum = parseFloat(aValue.toString().replace(/[^\d.]/g, '')) || 0;
                        const bNum = parseFloat(bValue.toString().replace(/[^\d.]/g, '')) || 0;
                        
                        return this.soldSortOrder === 'asc' ? aNum - bNum : bNum - aNum;
                    } catch (error) {
                        console.error('排序出错:', error);
                        return 0;
                    }
                });
            }
            
            // 处理显示格式
            return houses.map(house => ({
                ...house,
                // 统一楼层显示格式
                楼层: house.总层数 ? `${house.楼层}/共${house.总层数}层` : house.楼层
            }));
        },
        allSoldHouses() {
            return this.soldHouses;
        },
        allOnSaleHouses() {
            return this.onSaleHouses;
        },
        dedupedOnSaleHouses() {
            const onSaleMap = new Map();
            this.onSaleHouses.forEach(house => {
                const beikeId = house.贝壳编号 ? house.贝壳编号.toString().trim() : '';
                if (beikeId) {
                    onSaleMap.set(beikeId, house);
                } else {
                    const uniqueId = `unique_${Date.now()}_${Math.random()}`;
                    onSaleMap.set(uniqueId, house);
                }
            });
            return Array.from(onSaleMap.values());
        }
    },
    methods: {
        async fetchOnSaleHouses() {
            try {
                this.loading = true;
                const response = await fetch(`${API_BASE_URL}/houses/on-sale`);
                if (!response.ok) throw new Error('获取在售房源失败');
                const data = await response.json();
                this.onSaleHouses = data.data;
                this.updateCharts();
            } catch (error) {
                console.error('获取在售房源错误:', error);
                this.error = error.message;
            } finally {
                this.loading = false;
            }
        },
        async fetchSoldHouses() {
            try {
                this.loading = true;
                const response = await fetch(`${API_BASE_URL}/houses/sold`);
                if (!response.ok) throw new Error('获取成交房源失败');
                const data = await response.json();
                this.soldHouses = data.data;
                this.updateCharts();
            } catch (error) {
                console.error('获取成交房源错误:', error);
                this.error = error.message;
            } finally {
                this.loading = false;
            }
        },
        filterHouses() {
            if (!this.selectedHouseType && !this.selectedFloorLevel) {
                this.filteredOnSaleHouses = this.onSaleHouses;
                this.filteredSoldHouses = this.soldHouses;
                this.updateCharts();
                return;
            }

            // 打印当前选择的户型和楼层
            console.log('Selected house type:', this.selectedHouseType);
            console.log('Selected floor level:', this.selectedFloorLevel);

            // 在售房源过滤
            this.filteredOnSaleHouses = this.onSaleHouses.filter(house => {
                let matchHouseType = true;
                let matchFloorLevel = true;

                if (this.selectedHouseType) {
                    const houseType = house.户型 || '';
                    if (this.selectedHouseType === '其他') {
                        matchHouseType = !houseType.match(/^[一二三四1234][室房]/);
                    } else {
                        let pattern;
                        switch(this.selectedHouseType) {
                            case '一室':
                                pattern = /^([一1])[室房]/;
                                break;
                            case '两室':
                                pattern = /^([二2])[室房]/;
                                break;
                            case '三室':
                                pattern = /^([三3])[室房]/;
                                break;
                            case '四室':
                                pattern = /^([四4])[室房]/;
                                break;
                            default:
                                pattern = new RegExp(`^${this.selectedHouseType.replace(/[室房]/, '')}[室房]`);
                        }
                        matchHouseType = houseType.match(pattern);
                    }
                }

                if (this.selectedFloorLevel) {
                    const floorInfo = house.楼层 || '';
                    matchFloorLevel = floorInfo.includes(this.selectedFloorLevel);
                }

                return matchHouseType && matchFloorLevel;
            });

            // 成交房源过滤
            this.filteredSoldHouses = this.soldHouses.filter(house => {
                let matchHouseType = true;
                let matchFloorLevel = true;

                if (this.selectedHouseType) {
                    const houseType = house.户型 || '';
                    if (this.selectedHouseType === '其他') {
                        matchHouseType = !houseType.match(/^[一二三四1234][室房]/);
                    } else {
                        let pattern;
                        switch(this.selectedHouseType) {
                            case '一室':
                                pattern = /^([一1])[室房]/;
                                break;
                            case '两室':
                                pattern = /^([二2])[室房]/;
                                break;
                            case '三室':
                                pattern = /^([三3])[室房]/;
                                break;
                            case '四室':
                                pattern = /^([四4])[室房]/;
                                break;
                            default:
                                pattern = new RegExp(`^${this.selectedHouseType.replace(/[室房]/, '')}[室房]`);
                        }
                        matchHouseType = houseType.match(pattern);
                    }
                }

                if (this.selectedFloorLevel) {
                    // 直接使用楼层字段，因为成交房源的楼层已经是"低楼层"/"中楼层"/"高楼层"格式
                    const floorInfo = house.楼层 || '';
                    matchFloorLevel = floorInfo === this.selectedFloorLevel;
                }

                return matchHouseType && matchFloorLevel;
            });

            // 打印筛选后的结果数量
            console.log('Filtered on-sale houses:', this.filteredOnSaleHouses.length);
            console.log('Filtered sold houses:', this.filteredSoldHouses.length);

            this.$nextTick(() => {
                this.updateCharts();
            });
        },
        async searchHouses() {
            if (!this.searchQuery) {
                alert('请输入小区名称');
                return;
            }

            this.loading = true;
            try {
                // 获取在售房源数据
                const onSaleResponse = await axios.get(`${API_BASE_URL}/houses/on-sale`, {
                    params: {
                        community: this.searchQuery,
                        city: this.selectedCity,
                        limit: 1000
                    }
                });
                let onSaleData = onSaleResponse.data.data || [];
                
                // 按贝壳编号去重，保留最新数据
                const onSaleMap = new Map();
                
                // 先按创建时间排序，确保最新的数据在后面
                onSaleData.sort((a, b) => {
                    const timeA = a.数据创建时间 ? new Date(a.数据创建时间) : new Date(0);
                    const timeB = b.数据创建时间 ? new Date(b.数据创建时间) : new Date(0);
                    return timeA - timeB;
                });

                // 遍历并去重
                onSaleData.forEach(house => {
                    const beikeId = house.贝壳编号 ? house.贝壳编号.toString().trim() : '';
                    if (beikeId) {
                        onSaleMap.set(beikeId, house);
                    } else {
                        const uniqueId = `unique_${Date.now()}_${Math.random()}`;
                        onSaleMap.set(uniqueId, house);
                    }
                });

                // 转换回数组
                this.onSaleHouses = Array.from(onSaleMap.values());

                // 获取成交房源数据
                const soldResponse = await axios.get(`${API_BASE_URL}/houses/sold`, {
                    params: {
                        community: this.searchQuery,
                        city: this.selectedCity,
                        limit: 1000
                    }
                });
                this.soldHouses = soldResponse.data.data || [];

                // 应用筛选条件
                this.filterHouses();
                
                // 更新图表
                this.$nextTick(() => {
                    this.updateCharts();
                });

                // 在获取数据后预加载图片
                this.$nextTick(() => {
                    this.preloadImages(this.onSaleHouses);
                    this.preloadImages(this.soldHouses);
                });
            } catch (error) {
                console.error('获取数据失败:', error);
                if (error.response) {
                    console.error('错误响应:', error.response.data);
                    alert(error.response.data.detail || '获取数据失败，请稍后重试');
                } else {
                    console.error('网络错误:', error.message);
                    alert('网络错误，请检查网络连接');
                }
            } finally {
                this.loading = false;
            }
        },
        analyzeHouseTypes(houses) {
            const types = {};
            houses.forEach(house => {
                if (!house.户型) return;
                
                let type = house.户型.trim();
                const match = type.match(/(\d+)室/);
                if (match) {
                    const rooms = match[1] + '房';
                    types[rooms] = (types[rooms] || 0) + 1;
                } else {
                    types['其他'] = (types['其他'] || 0) + 1;
                }
            });
            return types;
        },

        analyzeFloors(houses) {
            const floors = { '低楼层': 0, '中楼层': 0, '高楼层': 0, '其他': 0 };
            houses.forEach(house => {
                let floor = '';
                if (house.楼层) {
                    floor = house.楼层;
                } else if (house.楼层信息) {
                    const match = house.楼层信息.match(/(低|中|高)楼层/);
                    if (match) {
                        floor = match[0];
                    }
                }

                if (floor.includes('低')) floors['低楼层']++;
                else if (floor.includes('中')) floors['中楼层']++;
                else if (floor.includes('高')) floors['高楼层']++;
                else floors['其他']++;
            });
            return floors;
        },

        createPieChart(ctx, data, title) {
            const canvas = document.getElementById(ctx);
            if (!canvas) {
                console.error(`找不到图表容器: ${ctx}`);
                return null;
            }

            const labels = Object.keys(data);
            const values = Object.values(data);
            const hasData = values.some(v => v > 0);

            if (!hasData) {
                this.drawNoDataMessage(canvas, title);
                return null;
            }

            const colors = [
                '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                '#FF9F40', '#FF6384', '#C9CBCF', '#7BC4C4', '#E35B5B'
            ];

            return new Chart(canvas, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        data: values,
                        backgroundColor: colors.slice(0, labels.length)
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: title,
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 10,
                                font: {
                                    size: 12
                                }
                            }
                        }
                    }
                }
            });
        },

        drawNoDataMessage(canvas, title) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#666';
            ctx.font = '14px Arial';
            ctx.fillText(title, canvas.width / 2, 30);
            ctx.fillText('暂无数据', canvas.width / 2, canvas.height / 2);
        },

        updateCharts() {
            Object.values(this.charts).forEach(chart => {
                if (chart) chart.destroy();
            });

            const onSaleTypes = this.analyzeHouseTypes(this.displayOnSaleHouses);
            const onSaleFloors = this.analyzeFloors(this.displayOnSaleHouses);
            const soldTypes = this.analyzeHouseTypes(this.displaySoldHouses);
            const soldFloors = this.analyzeFloors(this.displaySoldHouses);

            this.charts.onSaleType = this.createPieChart(
                'onSaleTypeChart',
                onSaleTypes,
                '在售户型分布'
            );

            this.charts.onSaleFloor = this.createPieChart(
                'onSaleFloorChart',
                onSaleFloors,
                '在售楼层分布'
            );

            this.charts.soldType = this.createPieChart(
                'soldTypeChart',
                soldTypes,
                '成交户型分布'
            );

            this.charts.soldFloor = this.createPieChart(
                'soldFloorChart',
                soldFloors,
                '成交楼层分布'
            );
        },
        toggleOnSaleSort(field) {
            if (this.onSaleSortField === field) {
                if (this.onSaleSortOrder === 'asc') {
                    this.onSaleSortOrder = 'desc';
                } else {
                    // 重置排序
                    this.onSaleSortField = '';
                    this.onSaleSortOrder = 'asc';
                }
            } else {
                this.onSaleSortField = field;
                this.onSaleSortOrder = 'asc';
            }
        },
        
        toggleSoldSort(field) {
            if (this.soldSortField === field) {
                if (this.soldSortOrder === 'asc') {
                    this.soldSortOrder = 'desc';
                } else {
                    // 重置排序
                    this.soldSortField = '';
                    this.soldSortOrder = 'asc';
                }
            } else {
                this.soldSortField = field;
                this.soldSortOrder = 'asc';
            }
        },

        handleImageError(event) {
            const img = event.target;
            img.src = this.defaultHouseImage;
            if (this.imageObserver) {
                this.imageObserver.unobserve(img);
                this.observedImages.delete(img);
            }
        },

        preloadImages(houses) {
            if (!houses || houses.length === 0) return;
            
            const imagesToLoad = houses
                .filter(house => house.户型图 && !this.loadedImages.has(house.户型图))
                .map(house => house.户型图);

            imagesToLoad.forEach(imageUrl => {
                if (this.imageLoadErrors.has(imageUrl)) return;

                const img = new Image();
                img.referrerPolicy = 'no-referrer';
                
                img.onload = () => {
                    this.loadedImages.add(imageUrl);
                    this.imageCache.set(imageUrl, img);
                };
                
                img.onerror = () => {
                    this.imageLoadErrors.add(imageUrl);
                };

                img.src = imageUrl;
            });
        },

        setupImageObserver() {
            this.imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (!this.loadedImages.has(img.src)) {
                            this.loadedImages.add(img.src);
                            this.imageObserver.unobserve(img);
                            this.observedImages.delete(img);
                        }
                    }
                });
            }, {
                rootMargin: '50px 0px',
                threshold: 0.1
            });
        },

        observeImage(el) {
            if (!this.imageObserver || this.observedImages.has(el)) return;
            
            this.imageObserver.observe(el);
            this.observedImages.add(el);
        },

        openEvaluation(house) {
            const params = new URLSearchParams({
                id: house._id,
                community: house.小区名
            });
            window.open(`evaluation.html?${params.toString()}`, '_blank');
        }
    },
    mounted() {
        this.setupImageObserver();
        this.searchQuery = '新泾七村';
        this.searchHouses();
    },
    beforeUnmount() {
        // 清理观察器
        if (this.imageObserver) {
            this.observedImages.forEach(img => {
                this.imageObserver.unobserve(img);
            });
            this.imageObserver.disconnect();
        }
    },
    watch: {
        // 监听房源数据变化，触发预加载
        displayOnSaleHouses(newHouses) {
            this.preloadImages(newHouses);
        },
        displaySoldHouses(newHouses) {
            this.preloadImages(newHouses);
        }
    }
});

// 全局使用Element Plus
for (const [key, component] of Object.entries(ElementPlus)) {
    if (key.startsWith('El')) {
        app.component(key, component);
    }
}

// 注册自定义指令
app.directive('intersection', vIntersection);

app.mount('#app');
