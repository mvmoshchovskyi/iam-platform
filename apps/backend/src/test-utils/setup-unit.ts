import { Logger } from '@nestjs/common';

// Keep unit test output readable; services log warnings for expected failure paths
Logger.overrideLogger(false);
