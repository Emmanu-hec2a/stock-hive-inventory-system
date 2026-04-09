from django.db import migrations, models
import uuid

class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='StockTransfer',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('quantity', models.PositiveIntegerField()),
                ('reference', models.CharField(blank=True, max_length=100, null=True)),
                ('note', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('from_shop', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='outgoing_transfers', to='inventory.shop')),
                ('product', models.ForeignKey(on_delete=models.deletion.PROTECT, to='inventory.product')),
                ('to_shop', models.ForeignKey(on_delete=models.CASCADE, related_name='incoming_transfers', to='inventory.shop')),
                ('transferred_by', models.ForeignKey(null=True, on_delete=models.SET_NULL, related_name='stock_transfers', to='accounts.user')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
