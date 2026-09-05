import { ManagerStaffController } from './manager-staff.controller';
import { ForbiddenException } from '@nestjs/common';

describe('ManagerStaffController', () => {
  let controller: ManagerStaffController;
  let staffService: any;
  let scope: any;

  const manager = { sub: 'mgr-1', role: 'MANAGER' };

  beforeEach(() => {
    staffService = {
      listHotelStaff: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      assignStaff: jest.fn().mockResolvedValue({ id: 'assign-1' }),
      removeStaff: jest.fn().mockResolvedValue({ removed: true }),
    };
    scope = {
      assertManagerOwnsHotel: jest.fn().mockResolvedValue(undefined),
    };

    controller = new ManagerStaffController(staffService, scope);
  });

  it('rejects listing staff if manager does not own hotel', async () => {
    scope.assertManagerOwnsHotel.mockRejectedValue(
      new ForbiddenException('You do not manage this hotel'),
    );

    await expect(
      controller.list(
        { hotelId: 'hotel-99' },
        { page: 1, pageSize: 20 },
        { user: manager },
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(scope.assertManagerOwnsHotel).toHaveBeenCalledWith(
      'mgr-1',
      'MANAGER',
      'hotel-99',
    );
  });

  it('lists hotel staff when manager owns hotel', async () => {
    const res = await controller.list(
      { hotelId: 'hotel-1' },
      { page: 1, pageSize: 20 },
      { user: manager },
    );

    expect(res).toEqual({ data: [], total: 0 });
    expect(staffService.listHotelStaff).toHaveBeenCalledWith('hotel-1', {
      page: 1,
      pageSize: 20,
    });
  });

  it('assigns staff to hotel when manager owns hotel', async () => {
    const res = await controller.assign(
      { hotelId: 'hotel-1' },
      { staffId: 'staff-1' },
      { user: manager },
    );

    expect(res).toEqual({ id: 'assign-1' });
    expect(staffService.assignStaff).toHaveBeenCalledWith(
      'hotel-1',
      { staffId: 'staff-1' },
      'mgr-1',
    );
  });

  it('removes staff from hotel when manager owns hotel', async () => {
    const res = await controller.remove(
      { hotelId: 'hotel-1', staffId: 'staff-1' },
      { user: manager },
    );

    expect(res).toEqual({ removed: true });
    expect(staffService.removeStaff).toHaveBeenCalledWith(
      'hotel-1',
      'staff-1',
      'mgr-1',
    );
  });
});
