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
  components: {
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          email: {
            type: 'string',
            format: 'email',
          },
          name: {
            type: 'string',
          },
          provider: {
            type: 'string',
            enum: ['local', 'google'],
          },
          providerId: {
            type: 'string',
            nullable: true,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      Session: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          userId: {
            type: 'string',
            format: 'uuid',
          },
          durationSeconds: {
            type: 'integer',
            minimum: 1,
          },
          categoryId: {
            type: 'string',
            nullable: true,
          },
          categoryLabel: {
            type: 'string',
            nullable: true,
          },
          startedAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          completedAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      NewSession: {
        type: 'object',
        required: ['durationSeconds'],
        properties: {
          durationSeconds: {
            type: 'integer',
            minimum: 1,
            description: '番茄鐘總秒數',
          },
          categoryId: {
            type: 'string',
            nullable: true,
          },
          categoryLabel: {
            type: 'string',
            nullable: true,
          },
          startedAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          completedAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
        },
      },
      Event: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          userId: {
            type: 'string',
            format: 'uuid',
          },
          sessionKey: {
            type: 'string',
            nullable: true,
          },
          eventType: {
            type: 'string',
          },
          payload: {
            type: 'object',
            nullable: true,
            additionalProperties: true,
          },
          occurredAt: {
            type: 'string',
            format: 'date-time',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      NewEvent: {
        type: 'object',
        required: ['eventType'],
        properties: {
          eventType: {
            type: 'string',
            description: '事件類型，例如 start、pause、reset、complete...等',
          },
          sessionKey: {
            type: 'string',
            nullable: true,
            description: '用於將多個事件歸屬於同一次番茄鐘的識別字串',
          },
          payload: {
            type: 'object',
            nullable: true,
            additionalProperties: true,
            description: '事件額外資訊',
          },
          occurredAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: '事件發生時間（預設為伺服器收到請求的時間）',
          },
        },
      },
    },
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
};

const options = {
  definition,
  apis: ['./server/routes/**/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
