import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './swagger.js';
import healthRouter from './routes/health.js';
import { getEnv, getEnvNumber } from './config/env.js';

const app = express();

const isProduction = getEnv('NODE_ENV') === 'production';

app.use(cors());
app.use(express.json());
app.use(morgan(isProduction ? 'combined' : 'dev'));

app.get('/', (req, res) => {
  res.json({
    message: 'Tomato API server is running.',
  });
});

app.use('/health', healthRouter);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));

const port = getEnvNumber('SERVER_PORT', 4000);

app.listen(port, () => {
  console.log(`Tomato API server listening at http://localhost:${port}`);
  console.log(`Swagger UI available at http://localhost:${port}/docs`);
});

export default app;
