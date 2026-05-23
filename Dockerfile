FROM node:20-alpine

WORKDIR /app

# 只复制依赖文件先安装，利用 Docker 层缓存
COPY package*.json ./
RUN npm install --production

# 复制源码
COPY . .

# 创建数据目录
RUN mkdir -p data

EXPOSE 5173

# 默认邮箱可选，通过环境变量配置
ENV MAIL_USER=
ENV MAIL_PASS=

CMD ["node", "server.js"]
