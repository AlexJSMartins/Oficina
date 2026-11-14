import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  // 1. Busca Rápida para o Autocomplete do Modal de Orçamento
  async searchCatalog(query: string) {
    if (!query || query.trim().length === 0) {
      return this.prisma.catalogItem.findMany({
        take: 15,
        include: { supplier: true },
        orderBy: { name: 'asc' },
      });
    }

    return this.prisma.catalogItem.findMany({
      where: {
        OR: [
          { name: { contains: query.trim(), mode: 'insensitive' } },
          { code: { contains: query.trim(), mode: 'insensitive' } },
        ],
      },
      take: 15,
      include: { supplier: true },
      orderBy: { name: 'asc' },
    });
  }

  // 2. Listar todo o Catálogo (Peças e Serviços) com Fornecedor e Histórico
  async getInventory() {
    const items = await this.prisma.catalogItem.findMany({
      include: {
        supplier: true,
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
      orderBy: { name: 'asc' },
    });

    const movements = await this.prisma.stockMovement.findMany({
      include: {
        item: {
          include: { supplier: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return { items, movements };
  }

  // 3. Criar Peça ou Serviço Padrão
  async createItem(dto: any, userId: string) {
    const cleanCode = dto.code ? String(dto.code).trim().toUpperCase() : null;

    if (cleanCode) {
      const existing = await this.prisma.catalogItem.findUnique({
        where: { code: cleanCode },
      });
      if (existing) {
        throw new BadRequestException(`O código ${cleanCode} já está em uso por "${existing.name}".`);
      }
    }

    const initialStock = dto.type === 'LABOR' ? 0 : Number(dto.stock || 0);

    const created = await this.prisma.catalogItem.create({
      data: {
        type: dto.type || 'PART',
        code: cleanCode,
        name: String(dto.name).trim(),
        costPrice: Number(dto.costPrice || 0),
        salePrice: Number(dto.salePrice || 0),
        stock: initialStock,
        minStock: dto.type === 'LABOR' ? 0 : Number(dto.minStock || 0),
        supplierId: dto.supplierId || null,
      },
    });

    if (initialStock > 0) {
      await this.prisma.stockMovement.create({
        data: {
          catalogItemId: created.id,
          type: 'IN',
          quantity: initialStock,
          reason: 'Saldo inicial de cadastro',
          createdById: userId,
        },
      });
    }

    return created;
  }

  // 4. Editar Peça ou Serviço
  async updateItem(id: string, dto: any) {
    const cleanCode = dto.code ? String(dto.code).trim().toUpperCase() : null;

    if (cleanCode) {
      const existing = await this.prisma.catalogItem.findUnique({
        where: { code: cleanCode },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException(`O código ${cleanCode} já pertence a outro item.`);
      }
    }

    return this.prisma.catalogItem.update({
      where: { id },
      data: {
        type: dto.type,
        code: cleanCode,
        name: dto.name ? String(dto.name).trim() : undefined,
        costPrice: dto.costPrice !== undefined ? Number(dto.costPrice) : undefined,
        salePrice: dto.salePrice !== undefined ? Number(dto.salePrice) : undefined,
        stock: dto.stock !== undefined ? Number(dto.stock) : undefined,
        minStock: dto.minStock !== undefined ? Number(dto.minStock) : undefined,
        supplierId: dto.supplierId === '' ? null : dto.supplierId,
      },
    });
  }

  // 5. Excluir Item do Catálogo
  async deleteItem(id: string) {
    return this.prisma.catalogItem.delete({ where: { id } });
  }

  // 6. Entrada ou Saída Manual de Estoque (Reposição de Compra)
  async adjustStock(
    id: string,
    dto: { type: 'IN' | 'OUT'; quantity: number; reason?: string; newCostPrice?: number },
    userId: string,
  ) {
    const item = await this.prisma.catalogItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item não encontrado.');

    const qty = Number(dto.quantity || 0);
    if (qty <= 0) throw new BadRequestException('A quantidade deve ser maior que zero.');

    if (dto.type === 'OUT' && item.stock < qty) {
      throw new BadRequestException(`Estoque insuficiente. Saldo atual: ${item.stock}`);
    }

    const updatedStock = dto.type === 'IN' ? item.stock + qty : item.stock - qty;

    return this.prisma.$transaction([
      this.prisma.catalogItem.update({
        where: { id },
        data: {
          stock: updatedStock,
          costPrice: dto.newCostPrice !== undefined && dto.newCostPrice > 0 ? Number(dto.newCostPrice) : undefined,
        },
      }),
      this.prisma.stockMovement.create({
        data: {
          catalogItemId: id,
          type: dto.type,
          quantity: qty,
          reason: dto.reason || (dto.type === 'IN' ? 'Entrada / Compra para estoque' : 'Baixa avulsa'),
          createdById: userId,
        },
      }),
    ]);
  }

  // 7. Registrar Peça com Defeito (Sai do estoque e não volta / Monitoramento de Qualidade)
  async registerDefect(
    dto: { itemId: string; quantity: number; reason: string; deductFromStock?: boolean },
    userId: string,
  ) {
    const item = await this.prisma.catalogItem.findUnique({ where: { id: dto.itemId } });
    if (!item) throw new NotFoundException('Peça não encontrada no catálogo.');

    const qty = Number(dto.quantity || 1);
    const shouldDeduct = dto.deductFromStock !== false;

    if (shouldDeduct && item.stock < qty) {
      throw new BadRequestException(
        `Estoque atual (${item.stock}) é menor que a quantidade com defeito (${qty}). Desmarque "Descontar do saldo atual" se a peça já havia saído em uma OS.`,
      );
    }

    const newStock = shouldDeduct ? Math.max(0, item.stock - qty) : item.stock;

    return this.prisma.$transaction([
      this.prisma.catalogItem.update({
        where: { id: item.id },
        data: {
          stock: newStock,
          defects: { increment: qty },
        },
      }),
      this.prisma.stockMovement.create({
        data: {
          catalogItemId: item.id,
          type: 'DEFECT',
          quantity: qty,
          reason: dto.reason || 'Peça apresentou defeito / Garantia sem retorno',
          createdById: userId,
        },
      }),
    ]);
  }

  // 8. Listar Fornecedores com Ranking e Métricas de Peças e Defeitos
  async getAllSuppliers() {
    const suppliers = await this.prisma.supplier.findMany({
      include: {
        items: true,
      },
      orderBy: { rating: 'desc' },
    });

    return suppliers.map((s) => {
      const partsCount = s.items.length;
      const totalStockUnits = s.items.reduce((acc, i) => acc + Number(i.stock || 0), 0);
      const totalStockValue = s.items.reduce(
        (acc, i) => acc + Number(i.stock || 0) * Number(i.costPrice || 0),
        0,
      );
      const totalDefects = s.items.reduce((acc, i) => acc + Number(i.defects || 0), 0);
      const defectLossValue = s.items.reduce(
        (acc, i) => acc + Number(i.defects || 0) * Number(i.costPrice || 0),
        0,
      );

      return {
        ...s,
        stats: {
          partsCount,
          totalStockUnits,
          totalStockValue,
          totalDefects,
          defectLossValue,
        },
      };
    });
  }

  // 9. Criar Fornecedor
  async createSupplier(dto: { name: string; phone?: string; email?: string; document?: string; rating?: number }) {
    return this.prisma.supplier.create({
      data: {
        name: String(dto.name).trim(),
        phone: dto.phone ? String(dto.phone).trim() : null,
        email: dto.email ? String(dto.email).trim() : null,
        document: dto.document ? String(dto.document).trim() : null,
        rating: dto.rating !== undefined ? Number(dto.rating) : 5.0,
      },
    });
  }

  // 10. Atualizar Fornecedor (incluindo Nota / Ranking)
  async updateSupplier(id: string, dto: any) {
    return this.prisma.supplier.update({
      where: { id },
      data: {
        name: dto.name ? String(dto.name).trim() : undefined,
        phone: dto.phone !== undefined ? dto.phone : undefined,
        email: dto.email !== undefined ? dto.email : undefined,
        document: dto.document !== undefined ? dto.document : undefined,
        rating: dto.rating !== undefined ? Number(dto.rating) : undefined,
      },
    });
  }

  // 11. Excluir Fornecedor
  async deleteSupplier(id: string) {
    await this.prisma.catalogItem.updateMany({
      where: { supplierId: id },
      data: { supplierId: null },
    });
    return this.prisma.supplier.delete({ where: { id } });
  }

  // 12. Importação em Lote via Excel (Peças, Serviços e Fornecedores Automáticos)
  async bulkImport(rows: any[], userId: string) {
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestException('A planilha enviada está vazia.');
    }

    const parseNum = (val: any): number => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      const str = String(val).replace(/[R$\s]/g, '');
      if (str.includes(',') && str.includes('.')) {
        return Number(str.replace(/\./g, '').replace(',', '.')) || 0;
      }
      if (str.includes(',')) return Number(str.replace(',', '.')) || 0;
      return Number(str) || 0;
    };

    let createdCount = 0;
    let updatedCount = 0;

    for (const row of rows) {
      const name = String(row.name || row.Nome || row.Descricao || '').trim();
      if (!name) continue;

      const rawType = String(row.type || row.Tipo || 'PART').toUpperCase();
      const isLabor =
        rawType.includes('SERV') || rawType.includes('LABOR') || rawType.includes('MAO');
      const itemType = isLabor ? 'LABOR' : 'PART';

      const code = row.code || row.Codigo || row.SKU
        ? String(row.code || row.Codigo || row.SKU).trim().toUpperCase()
        : null;

      const costPrice = parseNum(row.costPrice ?? row.Custo ?? row.Preco_Custo ?? 0);
      const salePrice = parseNum(row.salePrice ?? row.Venda ?? row.Preco_Venda ?? 0);
      const stock = isLabor ? 0 : Math.round(parseNum(row.stock ?? row.Estoque ?? row.Estoque_Atual ?? 0));
      const minStock = isLabor ? 0 : Math.round(parseNum(row.minStock ?? row.Estoque_Minimo ?? 2));
      const supplierName = String(row.supplier || row.Fornecedor || '').trim();

      let supplierId: string | null = null;
      if (supplierName && !isLabor) {
        let sup = await this.prisma.supplier.findFirst({
          where: { name: { equals: supplierName, mode: 'insensitive' } },
        });
        if (!sup) {
          sup = await this.prisma.supplier.create({
            data: { name: supplierName, rating: 5.0 },
          });
        }
        supplierId = sup.id;
      }

      const existing = code
        ? await this.prisma.catalogItem.findUnique({ where: { code } })
        : await this.prisma.catalogItem.findFirst({
            where: { name: { equals: name, mode: 'insensitive' }, type: itemType },
          });

      if (existing) {
        await this.prisma.catalogItem.update({
          where: { id: existing.id },
          data: {
            name,
            costPrice: costPrice > 0 ? costPrice : existing.costPrice,
            salePrice: salePrice > 0 ? salePrice : existing.salePrice,
            stock: stock > 0 ? stock : existing.stock,
            minStock,
            supplierId: supplierId || existing.supplierId,
          },
        });
        updatedCount++;
      } else {
        const created = await this.prisma.catalogItem.create({
          data: {
            type: itemType,
            code,
            name,
            costPrice,
            salePrice,
            stock,
            minStock,
            supplierId,
          },
        });

        if (stock > 0) {
          await this.prisma.stockMovement.create({
            data: {
              catalogItemId: created.id,
              type: 'IN',
              quantity: stock,
              reason: 'Importação via Planilha Excel',
              createdById: userId,
            },
          });
        }
        createdCount++;
      }
    }

    return {
      message: 'Catálogo importado com sucesso!',
      createdCount,
      updatedCount,
    };
  }
}