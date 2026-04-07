# Generated migration for alerts app

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('inventory', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='StockAlert',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('channel', models.CharField(choices=[('in_app', 'In-App'), ('whatsapp', 'WhatsApp')], max_length=20)),
                ('status', models.CharField(choices=[('sent', 'Sent'), ('failed', 'Failed'), ('pending', 'Pending')], default='pending', max_length=20)),
                ('stock_level', models.IntegerField()),
                ('threshold', models.IntegerField()),
                ('error_msg', models.TextField(blank=True, null=True)),
                ('sent_at', models.DateTimeField(auto_now_add=True)),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='stock_alerts', to='inventory.product')),
                ('shop', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='stock_alerts', to='inventory.shop')),
            ],
            options={
                'ordering': ['-sent_at'],
            },
        ),
        migrations.CreateModel(
            name='InAppNotification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('type', models.CharField(choices=[('low_stock', 'Low Stock'), ('out_of_stock', 'Out of Stock'), ('subscription_expiring', 'Subscription Expiring'), ('payment_success', 'Payment Success'), ('payment_failed', 'Payment Failed')], max_length=30)),
                ('title', models.CharField(max_length=100)),
                ('message', models.TextField()),
                ('is_read', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('product', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='notifications', to='inventory.product')),
                ('shop', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notifications', to='inventory.shop')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='WhatsAppConnection',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('phone_number', models.CharField(max_length=15)),
                ('is_active', models.BooleanField(default=True)),
                ('connected_at', models.DateTimeField(auto_now_add=True)),
                ('last_message_at', models.DateTimeField(blank=True, null=True)),
                ('shop', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='whatsapp_connection', to='inventory.shop')),
            ],
            options={
                'verbose_name': 'WhatsApp Connection',
                'verbose_name_plural': 'WhatsApp Connections',
            },
        ),
        migrations.AddIndex(
            model_name='stockalert',
            index=models.Index(fields=['product', 'channel', 'sent_at'], name='alerts_stock_product_channel_idx'),
        ),
        migrations.AddIndex(
            model_name='stockalert',
            index=models.Index(fields=['shop', 'sent_at'], name='alerts_stock_shop_idx'),
        ),
        migrations.AddIndex(
            model_name='inappnotification',
            index=models.Index(fields=['shop', 'is_read', '-created_at'], name='alerts_notif_shop_idx'),
        ),
    ]
