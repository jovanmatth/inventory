import { NextRequest, NextResponse } from 'next/server';
import { inventoryRepo, historyRepo } from '@/lib/data-provider';
import { InventoryItem } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get('location') || undefined;
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;

    const items = await inventoryRepo.getAll({ location, status, search });
    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      item_name,
      brand,
      qty,
      min_qty_alert,
      location,
      location_detail,
      item_detail,
      variant,
      status,
      condition,
      date_added,
      borrowing_type,
      performed_by,
    } = body;

    if (!item_name || !brand || location === undefined || !borrowing_type) {
      return NextResponse.json({ success: false, message: 'Field wajib belum lengkap' }, { status: 400 });
    }

    const newItem: InventoryItem = {
      item_id: `ITM-${Date.now()}`,
      item_name,
      brand,
      qty: Number(qty) || 0,
      min_qty_alert: Number(min_qty_alert) || 2,
      location,
      location_detail: location_detail || '',
      item_detail: item_detail || '',
      variant: variant || '',
      status: status || 'Available',
      condition: condition || 'Good',
      date_added: date_added || new Date().toISOString().split('T')[0],
      borrowing_type,
    };

    await inventoryRepo.create(newItem);

    // Audit log
    if (performed_by) {
      await historyRepo.log({
        log_id: `LOG-${Date.now()}`,
        item_id: newItem.item_id,
        action_type: 'Stock_In',
        qty_changed: newItem.qty,
        timestamp: new Date().toISOString(),
        performed_by,
      });
    }

    return NextResponse.json({ success: true, message: 'Item Added Successfully', item: newItem });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      item_id,
      item_name,
      brand,
      qty,
      min_qty_alert,
      location,
      location_detail,
      item_detail,
      variant,
      status,
      condition,
      date_added,
      borrowing_type,
      performed_by,
    } = body;

    const existing = await inventoryRepo.getById(item_id);
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Barang tidak ditemukan' }, { status: 404 });
    }

    const updatedItem: InventoryItem = {
      item_id,
      item_name,
      brand,
      qty: Number(qty),
      min_qty_alert: Number(min_qty_alert),
      location,
      location_detail,
      item_detail,
      variant,
      status,
      condition,
      date_added,
      borrowing_type,
    };

    await inventoryRepo.update(updatedItem);

    if (performed_by) {
      const diff = Number(qty) - existing.qty;
      await historyRepo.log({
        log_id: `LOG-${Date.now()}`,
        item_id,
        action_type: condition === 'Damaged' && existing.condition !== 'Damaged' ? 'Damaged' : 'Edited',
        qty_changed: diff,
        timestamp: new Date().toISOString(),
        performed_by,
      });
    }

    return NextResponse.json({ success: true, message: 'Item Updated Successfully', item: updatedItem });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'Item ID diperlukan' }, { status: 400 });
    }

    await inventoryRepo.delete(id);
    return NextResponse.json({ success: true, message: 'Item Deleted Successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
