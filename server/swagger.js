import swaggerJsdoc from 'swagger-jsdoc';
import { getEnv } from './config/env.js';

const serverUrl = getEnv('SWAGGER_SERVER_URL', `http://localhost:${getEnv('SERVER_PORT', '4000')}`);

const definition = {
  openapi: '3.0.3',
  info: {
    title: 'Tomato API',
    version: '1.0.0',
    description: '後端 API 文件，提供 Swagger UI 查看與測試。',
  },
  servers: [
    {
      url: serverUrl,
    },
  ],
};

const options = {
  definition,
  apis: ['./server/routes/**/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
