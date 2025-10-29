import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './swagger.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import sessionsRouter from './routes/sessions.js';
import eventsRouter from './routes/events.js';
import categoriesRouter from './routes/categories.js';
import dailyTasksRouter from './routes/dailyTasks.js';
import todosRouter from './routes/todos.js';
import studyGroupsRouter from './routes/studyGroups.js';
import encouragementRouter from './routes/encouragement.js';
import { getEnv, getEnvNumber } from './config/env.js';
import { ensureDefaultCategories } from './repositories/categoryRepository.js';
import { ensureTodoSchema } from './repositories/todoRepository.js';

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
app.use('/auth', authRouter);
app.use('/sessions', sessionsRouter);
app.use('/events', eventsRouter);
app.use('/categories', categoriesRouter);
app.use('/daily-tasks', dailyTasksRouter);
app.use('/todos', todosRouter);
app.use('/study-groups', studyGroupsRouter);
app.use('/encouragement', encouragementRouter);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));

const port = getEnvNumber('SERVER_PORT', 4000);

Promise.all([ensureTodoSchema(), ensureDefaultCategories()])
  .catch((error) => {
    console.error('Failed to initialize application', error);
  })
  .finally(() => {
    app.listen(port, () => {
      console.log(`Tomato API server listening at http://localhost:${port}`);
      console.log(`Swagger UI available at http://localhost:${port}/docs`);
    });
  });

export default app;
