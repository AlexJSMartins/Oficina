import { Test, TestingModule } from '@nestjs/testing';
import { FiscalController } from './fiscal.controller';

describe('FiscalController', () => {
  let controller: FiscalController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FiscalController],
    }).compile();

    controller = module.get<FiscalController>(FiscalController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
